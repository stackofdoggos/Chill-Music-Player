import * as THREE from 'three'
import { assetUrl } from '../assetUrl'
import bakeMeta from '../../public/lightmaps/meta.json'

/**
 * Cycles-baked irradiance for the five static room-shell surfaces, which all
 * carry a clean non-overlapping 0-1 unwrap on UV0 already.
 *
 * This replaces the hemisphere + fill + window area lights *on these surfaces
 * only*: as uniform sources they add the same irradiance everywhere and so
 * cannot produce the window falloff, corner darkening or soft contact shadows
 * that make the reference render read as three-dimensional.
 *
 * The sun stays real-time. The bake is (everything) - (sun direct), so direct
 * sunlight and its moving shadows are still the renderer's job.
 *
 * Three sets are baked so the day-night slider still works. Two adjacent sets
 * are mixed *in the shader* (see `patchForBlend`) rather than by swapping maps,
 * because a swap pops and a CPU blend would cost a texture upload per frame.
 */

/** Room shell renders on this layer so the ambient rig can be excluded from it. */
export const LIGHTMAP_LAYER = 1

/**
 * Global multiplier on top of each map's own encode scale.
 *
 * The bake is physically correct and this room has one 1.35x1.05m window in a
 * 6.4x4.7m floor plan, so its true irradiance is *low* — the Cycles preview of
 * the same rig is a dim, moody room. Reproducing that literally would be
 * accurate and would look nothing like the reference, which is a brighter
 * space. Games solve this with exposure: keep the baked distribution, which is
 * where all the realism lives, and lift the level. Raising this instead of the
 * bake's sky strength keeps the ratio between surfaces intact.
 */
export const LIGHTMAP_EXPOSURE = 5.5

const SHELL_NAMES = ['floor', 'wall_back', 'wall_left', 'wall_right', 'ceiling'] as const
export type ShellName = (typeof SHELL_NAMES)[number]

const SET_NAMES = ['night', 'day', 'golden'] as const
export type SetName = (typeof SET_NAMES)[number]

/** `${set}_${shell}` -> public URL, shaped for drei's `useTexture` map form. */
export const LIGHTMAP_URLS = Object.fromEntries(
  SET_NAMES.flatMap((set) =>
    SHELL_NAMES.map((name) => [`${set}_${name}`, assetUrl(`lightmaps/${set}_${name}.png`)]),
  ),
) as Record<string, string>

/**
 * Divisor each map was normalised by before its 8-bit sRGB encode, straight
 * from the bake's own report so the two cannot drift apart.
 */
const SCALES = bakeMeta.sets as Record<SetName, { maps: Record<ShellName, { scale: number }> }>

function scaleOf(set: SetName, name: ShellName) {
  return SCALES[set].maps[name].scale
}

/**
 * Day-phase positions of each baked set. `night` bookends the cycle so the
 * slider wraps without a discontinuity. Values track the `dayNight.ts`
 * keyframes they were baked against.
 */
const ANCHORS: { t: number; set: SetName }[] = [
  { t: 0.0, set: 'night' },
  { t: 0.48, set: 'day' },
  { t: 0.7, set: 'golden' },
  { t: 1.0, set: 'night' },
]

function blendAt(dayPhase: number) {
  const t = THREE.MathUtils.clamp(dayPhase, 0, 1)
  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const a = ANCHORS[i]
    const b = ANCHORS[i + 1]
    if (t <= b.t) {
      const span = b.t - a.t
      return { a: a.set, b: b.set, mix: span <= 0 ? 0 : (t - a.t) / span }
    }
  }
  return { a: 'night' as SetName, b: 'night' as SetName, mix: 0 }
}

/**
 * Neutral plaster/timber albedo. The reference's wall is an earthy grey that
 * only looks warm because the light hitting it is warm — tinting the albedo
 * per day-phase instead reads as a filter over the whole frame.
 */
const SHELL_ALBEDO: Partial<Record<ShellName, string>> = {
  // walls carry the microcement diffuse, so the tint must not double-darken it
  wall_back: '#ffffff',
  wall_left: '#ffffff',
  wall_right: '#ffffff',
  ceiling: '#ded9d2',
}

type BlendUniforms = {
  lightMapB: THREE.IUniform<THREE.Texture | null>
  lightMapIntensityB: THREE.IUniform<number>
  lightMapMix: THREE.IUniform<number>
}

type Applied = {
  name: ShellName
  mesh: THREE.Mesh
  material: THREE.MeshStandardMaterial
  originalMaterial: THREE.Material | THREE.Material[]
  prevLayerMask: number
  uniforms: BlendUniforms
}

const applied = new Map<ShellName, Applied>()

function shellMaterial(mesh: THREE.Mesh): THREE.MeshStandardMaterial | null {
  const raw = mesh.material
  const mat = Array.isArray(raw) ? raw[0] : raw
  return mat instanceof THREE.MeshStandardMaterial ? mat : null
}

export function prepareLightmap(tex: THREE.Texture): THREE.Texture {
  tex.colorSpace = THREE.SRGBColorSpace
  // the bake lives on UV0 (three defaults lightMap to UV1)
  tex.channel = 0
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return tex
}

/**
 * Add a second lightmap sampler and mix it with the built-in one.
 *
 * three's `lights_fragment_maps` chunk applies `lightMap * lightMapIntensity`;
 * this rewrites that single line so the two baked sets cross-fade with their own
 * intensities. Both sample `vLightMapUv`, since every set shares UV0.
 */
function patchForBlend(material: THREE.MeshStandardMaterial): BlendUniforms {
  const uniforms: BlendUniforms = {
    lightMapB: { value: null },
    lightMapIntensityB: { value: 1 },
    lightMapMix: { value: 0 },
  }
  material.onBeforeCompile = (shader) => {
    shader.uniforms.lightMapB = uniforms.lightMapB
    shader.uniforms.lightMapIntensityB = uniforms.lightMapIntensityB
    shader.uniforms.lightMapMix = uniforms.lightMapMix
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D lightMapB;
uniform float lightMapIntensityB;
uniform float lightMapMix;`,
      )
      .replace(
        'vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;',
        `vec3 lightMapIrradiance = mix(
  lightMapTexel.rgb * lightMapIntensity,
  texture2D( lightMapB, vLightMapUv ).rgb * lightMapIntensityB,
  lightMapMix );`,
      )
  }
  return uniforms
}

export function applyLightmaps(
  nodes: Record<string, THREE.Object3D>,
  textures: Record<string, THREE.Texture>,
) {
  clearLightmaps()
  for (const name of SHELL_NAMES) {
    const mesh = nodes[name] as THREE.Mesh | undefined
    const source = mesh ? shellMaterial(mesh) : null
    if (!mesh || !source) continue

    // wall_left and wall_right share one material in the GLB, but each surface
    // needs its own maps and its own encode scale, so give every shell its own
    // instance before touching anything.
    const material = source.clone()
    const uniforms = patchForBlend(material)

    applied.set(name, {
      name,
      mesh,
      material,
      originalMaterial: mesh.material,
      prevLayerMask: mesh.layers.mask,
      uniforms,
    })

    for (const set of SET_NAMES) prepareLightmap(textures[`${set}_${name}`])
    material.lightMap = textures[`night_${name}`]
    material.lightMapIntensity = scaleOf('night', name) * LIGHTMAP_EXPOSURE
    // the HDRI is not layer-filtered, so it would re-flatten what the bake fixed
    material.envMapIntensity = 0
    // the ceiling's flat emissive was standing in for bounce light
    material.emissiveIntensity = 0
    const albedo = SHELL_ALBEDO[name]
    if (albedo) material.color.set(albedo)
    material.needsUpdate = true

    mesh.material = material
    // move off layer 0 entirely: three lights a mesh if they share *any* layer
    mesh.layers.set(LIGHTMAP_LAYER)
  }
}

/** Cross-fade the shell to the two sets bracketing `dayPhase`. Call per frame. */
export function updateLightmapPhase(
  dayPhase: number,
  textures: Record<string, THREE.Texture>,
) {
  if (applied.size === 0) return
  const { a, b, mix } = blendAt(dayPhase)
  for (const entry of applied.values()) {
    const { name, material, uniforms } = entry
    const texA = textures[`${a}_${name}`]
    if (material.lightMap !== texA) material.lightMap = texA
    material.lightMapIntensity = scaleOf(a, name) * LIGHTMAP_EXPOSURE
    uniforms.lightMapB.value = textures[`${b}_${name}`]
    uniforms.lightMapIntensityB.value = scaleOf(b, name) * LIGHTMAP_EXPOSURE
    uniforms.lightMapMix.value = mix
  }
}

export function clearLightmaps() {
  for (const a of applied.values()) {
    a.mesh.material = a.originalMaterial
    a.mesh.layers.mask = a.prevLayerMask
    a.material.dispose()
  }
  applied.clear()
}

/** Names currently driven by a lightmap — the per-phase wall tint must skip these. */
export function lightmappedNames(): Set<string> {
  return new Set(applied.keys())
}

export function lightmapsActive(): boolean {
  return applied.size > 0
}
