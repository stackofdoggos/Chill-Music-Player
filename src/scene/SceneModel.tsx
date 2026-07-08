import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import type { MeshStandardMaterial } from 'three'
import * as THREE from 'three'
import { engine } from '../audio/engine'
import { assetUrl } from '../assetUrl'
import { dragActiveOrRecent, requestUnfocus, useStore } from '../state/store'
import { ANCHOR_NAMES } from './anchors'
import { isShelfFocusPoint } from './layout'
import { sampleAtmosphere } from './dayNight'
import { DeskTop } from './DeskTop'
import { woodTexture } from './textures'

const GLB_PATH = assetUrl('models/room.glb')

type SceneModelContextValue = {
  nodes: Record<string, THREE.Object3D>
  ready: boolean
}

const SceneModelContext = createContext<SceneModelContextValue>({
  nodes: {},
  ready: false,
})

export function useSceneModel() {
  return useContext(SceneModelContext)
}

/** Hide GLB meshes replaced by runtime textures or code-driven interactives */
const HIDDEN_MESHES = new Set([
  'wall_art_frame',
  'wall_art_mat',
  'wall_art_painting',
  'desk_top',
])

/** GLB basket shells replaced by code-driven BasketShell (correct weave UVs) */
const BASKET_SHELL_RE =
  /^basket_(L|R)_(bottom|front|back|left|right)$/

/** Tonearm visuals — raycasts handled by Tonearm.tsx drag collider */
const TONEARM_VISUALS = new Set([
  'tonearm_tube',
  'headshell',
  'stylus',
  'counterweight',
])

function buildNodeMap(root: THREE.Object3D): Record<string, THREE.Object3D> {
  const map: Record<string, THREE.Object3D> = {}
  root.traverse((obj) => {
    map[obj.name] = obj
  })
  return map
}

function setupMesh(obj: THREE.Object3D) {
  if (obj.type !== 'Mesh') return
  const mesh = obj as THREE.Mesh
  mesh.castShadow = true
  mesh.receiveShadow = true
  if (HIDDEN_MESHES.has(mesh.name) || BASKET_SHELL_RE.test(mesh.name)) mesh.visible = false
  if (TONEARM_VISUALS.has(mesh.name)) mesh.raycast = () => {}
}

export function SceneModelProvider({ children }: { children: ReactNode }) {
  const gltf = useGLTF(GLB_PATH)
  const { scene, nodes } = useMemo(() => {
    const clone = gltf.scene.clone(true)
    clone.traverse(setupMesh)
    return { scene: clone, nodes: buildNodeMap(clone) }
  }, [gltf.scene])

  const backWallMat = useRef<MeshStandardMaterial | null>(null)
  const leftWallMat = useRef<MeshStandardMaterial | null>(null)
  const rightWallMat = useRef<MeshStandardMaterial | null>(null)
  const ceilingMat = useRef<MeshStandardMaterial | null>(null)
  const windowMat = useRef<MeshStandardMaterial | null>(null)

  useEffect(() => {
    const pick = (name: string) => {
      const mesh = nodes[name] as THREE.Mesh | undefined
      const mat = mesh?.material
      return (Array.isArray(mat) ? mat[0] : mat) as MeshStandardMaterial | undefined
    }
    backWallMat.current = pick('wall_back') ?? null
    leftWallMat.current = pick('wall_left') ?? null
    rightWallMat.current = pick('wall_right') ?? null
    ceilingMat.current = pick('ceiling') ?? null
    windowMat.current = pick('window_glass') ?? null

    const applyWood = (name: string, repeatX: number, repeatY: number, light = false, roughness = 0.7) => {
      const mesh = nodes[name] as THREE.Mesh | undefined
      const raw = mesh?.material
      const mat = (Array.isArray(raw) ? raw[0] : raw) as MeshStandardMaterial | undefined
      if (!mat) return
      mat.map = woodTexture(repeatX, repeatY, light)
      mat.roughness = roughness
      mat.metalness = 0
      mat.needsUpdate = true
    }
    applyWood('floor', 5, 5, true, 0.7)

    const applyLacquer = (
      name: string,
      {
        roughness,
        metalness,
        clearcoat,
        clearcoatRoughness,
        envMapIntensity,
      }: {
        roughness: number
        metalness: number
        clearcoat: number
        clearcoatRoughness: number
        envMapIntensity: number
      },
    ) => {
      const mesh = nodes[name] as THREE.Mesh | undefined
      const raw = mesh?.material
      const mat = (Array.isArray(raw) ? raw[0] : raw) as THREE.MeshStandardMaterial | undefined
      if (!mat) return
      const lacquer = new THREE.MeshPhysicalMaterial({
        color: mat.color,
        roughness,
        metalness,
        clearcoat,
        clearcoatRoughness,
        envMapIntensity,
      })
      mesh!.material = lacquer
    }
    applyLacquer('player_chassis', {
      roughness: 0.16,
      metalness: 0.06,
      clearcoat: 0.78,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.25,
    })
    applyLacquer('player_deck', {
      roughness: 0.22,
      metalness: 0.18,
      clearcoat: 0.55,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.05,
    })

    // Acrylic lid — boost env reflections; GLB exports KHR_materials_transmission on lid_acrylic
    nodes.lid_hinge?.traverse((obj) => {
      if (obj.type !== 'Mesh') return
      const mesh = obj as THREE.Mesh
      const raw = mesh.material
      const mats = Array.isArray(raw) ? raw : raw ? [raw] : []
      for (let i = 0; i < mats.length; i++) {
        const m = mats[i]
        if (m instanceof THREE.MeshPhysicalMaterial) {
          m.envMapIntensity = 1.65
          m.roughness = 0.013
          m.transmission = Math.min(1, (m.transmission || 0.92) + 0.053)
          m.needsUpdate = true
        } else if (m instanceof THREE.MeshStandardMaterial) {
          // Fallback if an old GLB is still cached without transmission
          const phys = new THREE.MeshPhysicalMaterial({
            color: m.color,
            roughness: 0.02,
            metalness: 0,
            transmission: 0.973,
            thickness: 0.012,
            ior: 1.45,
            envMapIntensity: 1.4,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
          })
          if (Array.isArray(mesh.material)) mesh.material[i] = phys
          else mesh.material = phys
        }
      }
    })

    if (import.meta.env.DEV) {
      ;(window as Window & { __anchors?: () => Record<string, number[]> }).__anchors = () => {
        const out: Record<string, number[]> = {}
        const v = new THREE.Vector3()
        for (const name of ANCHOR_NAMES) {
          const o = nodes[name]
          if (!o) continue
          o.updateWorldMatrix(true, false)
          o.getWorldPosition(v)
          out[name] = v.toArray()
        }
        console.table(out)
        return out
      }
    }
  }, [nodes])

  useFrame(() => {
    const a = sampleAtmosphere(useStore.getState().dayPhase)
    for (const ref of [backWallMat, leftWallMat, rightWallMat]) {
      if (ref.current) ref.current.color.copy(a.wallColor)
    }
    if (ceilingMat.current) {
      ceilingMat.current.emissive.copy(a.ceilingEmissive)
      ceilingMat.current.emissiveIntensity = a.ceilingEmissiveIntensity
    }
    if (windowMat.current) {
      windowMat.current.emissive.copy(a.windowEmissive)
      windowMat.current.emissiveIntensity = a.windowEmissiveIntensity
    }
  })

  const toOverview = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    requestUnfocus()
  }

  const onPointer = (e: ThreeEvent<MouseEvent>) => {
    const name = e.object.name
    if (name === 'player_chassis' || name === 'player_deck') {
      e.stopPropagation()
      if (!dragActiveOrRecent()) useStore.getState().setView('player')
      return
    }
    if (name === 'arm-base' || name === 'arm-pivot-column') {
      e.stopPropagation()
      if (dragActiveOrRecent()) return
      const s = useStore.getState()
      s.setView(s.view === 'arm' ? 'player' : 'arm')
      return
    }
    if (name === 'wall_back') {
      e.stopPropagation()
      if (isShelfFocusPoint(e.point.x, e.point.y)) {
        const action = useStore.getState().clickShelfBackdrop()
        if (action === 'putBack') engine.playSfx('sleeveIn', 0.85, 1.05)
        return
      }
      requestUnfocus()
      return
    }
    if (name.startsWith('basket_L')) {
      e.stopPropagation()
      if (dragActiveOrRecent()) return
      const wasOut = useStore.getState().basketOut === 0
      useStore.getState().toggleBasket(0)
      if (useStore.getState().basketOut !== (wasOut ? 0 : null)) {
        engine.playSfx(wasOut ? 'sleeveIn' : 'sleeveOut', 0.7, 0.7)
      }
      return
    }
    if (name.startsWith('basket_R')) {
      e.stopPropagation()
      if (dragActiveOrRecent()) return
      const wasOut = useStore.getState().basketOut === 1
      useStore.getState().toggleBasket(1)
      if (useStore.getState().basketOut !== (wasOut ? 1 : null)) {
        engine.playSfx(wasOut ? 'sleeveIn' : 'sleeveOut', 0.7, 0.7)
      }
      return
    }
    if (name.startsWith('spine_') || name === 'plant_pot' || name.startsWith('plant_leaf')) {
      e.stopPropagation()
      if (dragActiveOrRecent()) return
      const action = useStore.getState().clickShelfBackdrop()
      if (action === 'putBack') engine.playSfx('sleeveIn', 0.85, 1.05)
      return
    }
    if (name === 'shelf_backdrop' || name.startsWith('shelf_')) {
      e.stopPropagation()
      if (dragActiveOrRecent()) return
      const action = useStore.getState().clickShelfBackdrop()
      if (action === 'putBack') engine.playSfx('sleeveIn', 0.85, 1.05)
      return
    }
    if (['floor', 'wall_left', 'wall_right', 'skirting', 'ceiling'].includes(name)) {
      toOverview(e)
    }
  }

  const value = useMemo(() => ({ nodes, ready: true }), [nodes])

  return (
    <SceneModelContext.Provider value={value}>
      <primitive object={scene} onClick={onPointer} />
      <DeskTop />
      {children}
    </SceneModelContext.Provider>
  )
}

useGLTF.preload(GLB_PATH)
