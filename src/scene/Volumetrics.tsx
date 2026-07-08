import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ROOM } from './layout'
import { sampleAtmosphere, shaftStrength } from './dayNight'
import { useStore } from '../state/store'
import { useSettings } from '../state/settings'

/**
 * Cheap "volumetric" sun shafts at the window. No raymarching: a few additive
 * cross-plane quads with an animated falloff shader. Intensity follows the
 * day-night atmosphere (nothing renders at night) and the graphics settings mode.
 */

const WINDOW_POS = new THREE.Vector3(ROOM.w / 2 - 0.02, 1.45, -0.55)
const SHAFT_LEN = 4.2

const shaftVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const shaftFrag = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uTime;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y);
  }

  void main() {
    // uv.y = 1 at the window, 0 at the beam end
    // NOTE: pow(0, y) is NaN on Metal/ANGLE and one NaN pixel poisons the
    // whole bloom mip chain (black screen) — clamp the base away from zero
    float across = smoothstep(0.0, 0.38, vUv.x) * (1.0 - smoothstep(0.62, 1.0, vUv.x));
    float along = smoothstep(0.0, 0.06, 1.0 - vUv.y) * pow(max(vUv.y, 1e-4), 1.7);
    float drift = vnoise(vec2(vUv.x * 3.5 + uTime * 0.03, vUv.y * 2.5 - uTime * 0.045));
    float a = across * along * mix(0.6, 1.4, drift) * uIntensity;
    gl_FragColor = vec4(uColor * a, a);
  }
`

export function Volumetrics() {
  const mode = useSettings((s) => s.lightShafts)
  const group = useRef<THREE.Group>(null)

  const shaftMat = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: shaftVert,
      fragmentShader: shaftFrag,
      uniforms: {
        uColor: { value: new THREE.Color('#ffce90') },
        uIntensity: { value: 0 },
        uTime: { value: 0 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  }, [])

  useFrame((state) => {
    if (!group.current) return
    const a = sampleAtmosphere(useStore.getState().dayPhase)
    const raw = shaftStrength(a)
    const gain = mode === 'pronounced' ? 1.15 : 0.72
    const intensity = raw * gain
    shaftMat.uniforms.uIntensity.value = intensity
    shaftMat.uniforms.uTime.value = state.clock.elapsedTime
    ;(shaftMat.uniforms.uColor.value as THREE.Color).copy(a.windowEmissive)
    group.current.visible = intensity > 0.003

    // aim the beam from the window along the current sun direction
    const dir = a.keyTarget.clone().sub(a.keyPos).normalize()
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir)
    group.current.quaternion.copy(q)
  })

  if (mode === 'off') return null

  const width = mode === 'pronounced' ? 1.5 : 1.15
  return (
    <group position={WINDOW_POS.toArray()} ref={group} renderOrder={2}>
      {/* crossed quads, three slices across the window width */}
      {[-0.38, 0, 0.38].map((off) => (
        <group key={off} position={[off * 0.4, 0, off]}>
          <mesh material={shaftMat} position={[0, -SHAFT_LEN / 2, 0]}>
            <planeGeometry args={[width, SHAFT_LEN]} />
          </mesh>
          <mesh material={shaftMat} position={[0, -SHAFT_LEN / 2, 0]} rotation-y={Math.PI / 2}>
            <planeGeometry args={[width, SHAFT_LEN]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
