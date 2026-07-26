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
import { useGLTF, useTexture } from '@react-three/drei'
import type { MeshStandardMaterial } from 'three'
import * as THREE from 'three'
import { assetUrl } from '../assetUrl'
import { engine } from '../audio/engine'
import { dragActiveOrRecent, requestUnfocus, useStore } from '../state/store'
import { ANCHOR_NAMES } from './anchors'
import { isShelfFocusPoint } from './layout'
import { sampleAtmosphere } from './dayNight'
import { DeskTop } from './DeskTop'
import { woodTexture } from './textures'
import { GLB_PATH, GLB_USE_DRACO } from './preloadScene'
import {
  BOOKCASE_SMOOTH,
  createWalnutSmoothBundle,
  resolveShelfMesh,
  walnutNormalScale,
} from './walnutSmooth'

const GLB_PATH_LOCAL = GLB_PATH

/** Warm honey tint multiplied over the walnut albedo. */
const WALNUT_TINT = new THREE.Color('#f2c49a')
const WALNUT_EDGE = new THREE.Color('#3a1e12')
/** Bookshelf pegs / feet — dark matte grey */
const SHELF_BASE_METAL = new THREE.Color('#484a4f')

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

/** Prop mesh name prefixes after GLB export (parent `prop_*` empties may be applied away). */
const PROP_MESH_RE =
  /^(Leaves_Leaves|Plant_Pot_Pot|Retopo_New_Tree|alarm_clock|houd_hand|minute_hand|second_hand|ceramic_vase|Mesh_0_Material)/

function tagDecorProps(root: THREE.Object3D) {
  root.traverse((obj) => {
    let p: THREE.Object3D | null = obj
    while (p) {
      if (p.name.startsWith('prop_')) {
        obj.userData.decorProp = true
        return
      }
      p = p.parent
    }
  })
}

function isDecorProp(obj: THREE.Object3D): boolean {
  if (obj.userData.decorProp) return true
  if (PROP_MESH_RE.test(obj.name)) return true
  let o: THREE.Object3D | null = obj
  while (o) {
    if (o.name.startsWith('prop_')) return true
    o = o.parent
  }
  return false
}

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
  const gltf = useGLTF(GLB_PATH_LOCAL, GLB_USE_DRACO)
  const [walnutDiff, walnutNor, walnutRough] = useTexture([
    assetUrl('textures/walnut_diff.jpg'),
    assetUrl('textures/walnut_nor.jpg'),
    assetUrl('textures/walnut_rough.jpg'),
  ])
  const { scene, nodes } = useMemo(() => {
    if (!gltf.scene.userData.__roomSetup) {
      gltf.scene.traverse(setupMesh)
      tagDecorProps(gltf.scene)
      gltf.scene.userData.__roomSetup = true
    }
    return { scene: gltf.scene, nodes: buildNodeMap(gltf.scene) }
  }, [gltf.scene])

  const backWallMat = useRef<MeshStandardMaterial | null>(null)
  const leftWallMat = useRef<MeshStandardMaterial | null>(null)
  const rightWallMat = useRef<MeshStandardMaterial | null>(null)
  const ceilingMat = useRef<MeshStandardMaterial | null>(null)
  const windowMat = useRef<MeshStandardMaterial | null>(null)
  const walnutSmooth = useRef<ReturnType<typeof createWalnutSmoothBundle> | null>(null)

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

    walnutDiff.colorSpace = THREE.SRGBColorSpace
    for (const t of [walnutDiff, walnutNor, walnutRough]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.anisotropy = 4
    }

    walnutSmooth.current?.dispose()
    const smooth = createWalnutSmoothBundle(walnutDiff, walnutNor, walnutRough)
    walnutSmooth.current = smooth
    smooth.setAmount(BOOKCASE_SMOOTH)
    const nScale = walnutNormalScale(BOOKCASE_SMOOTH)

    const applyShelfWalnut = (name: string, clearcoat: number) => {
      const mesh = resolveShelfMesh(nodes, name)
      if (!mesh?.geometry) return
      const raw = mesh.material
      const geo = mesh.geometry as THREE.BufferGeometry | undefined
      const hasEdgeSlot = Array.isArray(raw)
        ? raw.length > 1
        : (geo?.groups?.length ?? 0) > 1
      const walnutMat = new THREE.MeshPhysicalMaterial({
        map: smooth.maps.map,
        normalMap: smooth.maps.normalMap,
        roughnessMap: smooth.maps.roughnessMap,
        color: WALNUT_TINT.clone(),
        metalness: 0,
        roughness: 1,
        normalScale: new THREE.Vector2(nScale, nScale),
        clearcoat,
        clearcoatRoughness: 0.42,
        envMapIntensity: 0.85,
      })
      if (hasEdgeSlot) {
        const edgeMat = new THREE.MeshStandardMaterial({
          color: WALNUT_EDGE,
          roughness: 0.88,
          metalness: 0,
        })
        mesh.material = [walnutMat, edgeMat]
      } else {
        mesh.material = walnutMat
      }
    }

    applyShelfWalnut('shelf_side_L', 0.12)
    applyShelfWalnut('shelf_side_R', 0.12)
    applyShelfWalnut('shelf_back', 0.12)
    for (const name of ['shelf_board_0', 'shelf_board_1', 'shelf_board_2', 'shelf_top']) {
      applyShelfWalnut(name, 0.24)
    }
    for (const name of ['shelf_foot_L', 'shelf_foot_R']) {
      const mesh = resolveShelfMesh(nodes, name) ?? (nodes[name] as THREE.Mesh | undefined)
      if (!mesh) continue
      mesh.material = new THREE.MeshStandardMaterial({
        color: SHELF_BASE_METAL,
        metalness: 0.45,
        roughness: 0.78,
        envMapIntensity: 0.25,
      })
    }

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

    // Acrylic lid — thin clear glass over the platter
    nodes.lid_hinge?.traverse((obj) => {
      if (obj.type !== 'Mesh') return
      const mesh = obj as THREE.Mesh
      const raw = mesh.material
      const mats = Array.isArray(raw) ? raw : raw ? [raw] : []
      for (let i = 0; i < mats.length; i++) {
        const m = mats[i]
        if (m instanceof THREE.MeshPhysicalMaterial) {
          m.envMapIntensity = 1.5
          m.roughness = 0.004
          m.metalness = 0
          m.transmission = 1
          m.thickness = 0.006
          m.ior = 1.45
          m.opacity = 1
          m.transparent = true
          m.depthWrite = false
          m.side = THREE.DoubleSide
          m.needsUpdate = true
        } else if (m instanceof THREE.MeshStandardMaterial) {
          const phys = new THREE.MeshPhysicalMaterial({
            color: m.color,
            roughness: 0.004,
            metalness: 0,
            transmission: 1,
            thickness: 0.006,
            ior: 1.45,
            envMapIntensity: 1.4,
            transparent: true,
            opacity: 1,
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

    return () => {
      walnutSmooth.current?.dispose()
      walnutSmooth.current = null
    }
  }, [nodes, walnutDiff, walnutNor, walnutRough])

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
    if (isDecorProp(e.object)) {
      e.stopPropagation()
      return
    }
    if (name.startsWith('spine_')) {
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
