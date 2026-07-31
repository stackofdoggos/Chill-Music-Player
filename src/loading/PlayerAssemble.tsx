import { useLayoutEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'
import { assetUrl } from '../assetUrl'
import { EXPLODED_PLAYER_PATH, TIMING } from './assembleConfig'
import { useAssembleLoop } from './useAssembleLoop'

const GLB = assetUrl(EXPLODED_PLAYER_PATH)

type Named = Record<string, THREE.Object3D>

function collect(root: THREE.Object3D): Named {
  const map: Named = {}
  root.traverse((o) => {
    if (o.name) map[o.name] = o
  })
  return map
}

type Snapshot = {
  pos: THREE.Vector3
  quat: THREE.Quaternion
  scale: THREE.Vector3
}

function snap(obj: THREE.Object3D): Snapshot {
  return {
    pos: obj.position.clone(),
    quat: obj.quaternion.clone(),
    scale: obj.scale.clone(),
  }
}

function hideAway(obj: THREE.Object3D, offset: THREE.Vector3) {
  obj.position.copy(offset)
  obj.scale.setScalar(0.001)
  obj.visible = false
}

function polishMaterials(root: THREE.Object3D) {
  const cream = new THREE.MeshStandardMaterial({
    color: '#f2efe8',
    roughness: 0.42,
    metalness: 0.06,
  })
  const rubber = new THREE.MeshStandardMaterial({ color: '#1a1a1c', roughness: 0.92, metalness: 0.02 })
  const metal = new THREE.MeshStandardMaterial({
    color: '#9aa0a8',
    roughness: 0.32,
    metalness: 0.78,
  })
  const darkMetal = new THREE.MeshStandardMaterial({ color: '#2c2c30', roughness: 0.38, metalness: 0.65 })
  const lid = new THREE.MeshPhysicalMaterial({
    color: '#eef2f6',
    roughness: 0.12,
    metalness: 0.02,
    transmission: 0.78,
    thickness: 0.35,
    ior: 1.45,
    transparent: true,
    opacity: 1,
    depthWrite: false,
  })
  const foot = new THREE.MeshStandardMaterial({ color: '#1c1814', roughness: 0.7, metalness: 0.05 })

  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return
    const n = o.name
    if (n.startsWith('player_chassis') || n === 'player_deck') o.material = cream
    else if (n === 'platter_mat') o.material = rubber
    else if (n === 'platter_mesh' || n === 'platter_strobe' || n === 'spindle') o.material = darkMetal
    else if (n.includes('knob') || n.includes('switch')) o.material = metal
    else if (n.startsWith('tonearm') || n.startsWith('arm') || n === 'headshell' || n === 'stylus' || n === 'counterweight')
      o.material = darkMetal
    else if (n === 'lid_mesh') o.material = lid
    else if (n.startsWith('player_foot')) o.material = foot
  })
}

/** Parts that attach onto the chassis, in assemble order. */
/** Offsets in local space — mostly radial on XZ so motion reads in top-down. */
const ATTACH_GROUPS = [
  {
    id: 'feet',
    names: ['player_foot_-1_-1', 'player_foot_-1_1', 'player_foot_1_-1', 'player_foot_1_1'],
    offset: new THREE.Vector3(0, 0.45, 0.35),
  },
  {
    id: 'platter',
    names: ['platter_spin', 'spindle'],
    offset: new THREE.Vector3(-0.55, 0.55, 0),
  },
  {
    id: 'tonearm',
    names: ['tonearm_base'],
    offset: new THREE.Vector3(0.55, 0.55, -0.1),
  },
  {
    id: 'controls',
    names: ['knob_speed', 'knob_volume', 'switch_power'],
    offset: new THREE.Vector3(0.4, 0.5, 0.35),
  },
  {
    id: 'lid',
    names: ['lid_hinge'],
    offset: new THREE.Vector3(0, 0.7, -0.45),
  },
] as const

export function PlayerAssemble() {
  const gltf = useGLTF(GLB)
  const spinRef = useRef<THREE.Group>(null)
  const vinylRef = useRef<THREE.Mesh | null>(null)

  const { scene, rests } = useMemo(() => {
    const cloned = gltf.scene.clone(true)
    const pr = cloned.getObjectByName('player_root')
    if (pr) {
      pr.position.set(0, 0, 0)
      pr.rotation.set(0, 0, 0)
    }
    polishMaterials(cloned)
    const nodes = collect(cloned)
    const rests: Record<string, Snapshot> = {}
    for (const g of ATTACH_GROUPS) {
      for (const n of g.names) {
        const o = nodes[n]
        if (o) rests[n] = snap(o)
      }
    }

    // Vinyl parented to platter so it tracks assemble + spin
    const platter = nodes['platter_spin']
    if (platter) {
      const geo = new THREE.CylinderGeometry(0.15, 0.15, 0.0024, 64)
      const mat = new THREE.MeshStandardMaterial({
        color: '#141416',
        roughness: 0.42,
        metalness: 0.12,
      })
      const vinyl = new THREE.Mesh(geo, mat)
      vinyl.name = 'loading_vinyl'
      vinyl.position.set(0, 0.028, 0)
      vinyl.visible = false
      vinyl.scale.setScalar(0.001)
      platter.add(vinyl)
      vinylRef.current = vinyl
    }

    return { scene: cloned, rests }
  }, [gltf.scene])

  useLayoutEffect(() => {
    const nodes = collect(scene)
    for (const g of ATTACH_GROUPS) {
      for (const n of g.names) {
        const o = nodes[n]
        if (!o || !rests[n]) continue
        hideAway(o, rests[n].pos.clone().add(g.offset))
      }
    }
    const vinyl = vinylRef.current
    if (vinyl) {
      vinyl.position.set(0, 1.2, 0)
      vinyl.scale.setScalar(0.001)
      vinyl.visible = false
    }
  }, [scene, rests])

  useAssembleLoop(
    true,
    (tl) => {
      const nodes = collect(scene)
      const spin = spinRef.current
      const vinyl = vinylRef.current
      if (!spin) return

      gsap.set(spin.rotation, { y: 0 })
      for (const g of ATTACH_GROUPS) {
        for (const n of g.names) {
          const o = nodes[n]
          const r = rests[n]
          if (!o || !r) continue
          o.visible = false
          o.position.copy(r.pos).add(g.offset)
          o.scale.setScalar(0.001)
          o.quaternion.copy(r.quat)
        }
      }
      if (vinyl) {
        vinyl.visible = false
        vinyl.position.set(0, 1.2, 0)
        vinyl.scale.setScalar(0.001)
      }

      const chassis = nodes['player_chassis']
      if (chassis) {
        gsap.set(chassis.scale, { x: 0.92, y: 0.92, z: 0.92 })
        tl.to(
          chassis.scale,
          { x: 1, y: 1, z: 1, duration: TIMING.partIn, ease: 'power3.out' },
          0,
        )
      }

      let t = 0.2
      for (const g of ATTACH_GROUPS) {
        for (const n of g.names) {
          const o = nodes[n]
          const r = rests[n]
          if (!o || !r) continue
          tl.call(() => {
            o.visible = true
          }, undefined, t)
          tl.to(
            o.position,
            {
              x: r.pos.x,
              y: r.pos.y,
              z: r.pos.z,
              duration: TIMING.partIn,
              ease: 'power3.out',
            },
            t,
          )
          tl.to(
            o.scale,
            {
              x: r.scale.x,
              y: r.scale.y,
              z: r.scale.z,
              duration: TIMING.partIn,
              ease: 'back.out(1.4)',
            },
            t,
          )
        }
        // Record drops right after platter group
        if (g.id === 'platter' && vinyl) {
          const vinylAt = t + TIMING.partStagger * 0.35
          tl.call(() => {
            vinyl.visible = true
          }, undefined, vinylAt)
          tl.to(
            vinyl.position,
            { x: 0, y: 0.028, z: 0, duration: TIMING.partIn * 1.15, ease: 'power2.inOut' },
            vinylAt,
          )
          tl.to(
            vinyl.scale,
            { x: 1, y: 1, z: 1, duration: TIMING.partIn, ease: 'back.out(1.2)' },
            vinylAt,
          )
        }
        t += TIMING.partStagger
      }

      const spinStart = t + TIMING.settle
      tl.to(
        spin.rotation,
        { y: Math.PI * 2, duration: TIMING.spinHold, ease: 'power1.inOut' },
        spinStart,
      )
    },
    [scene, rests],
  )

  // Flat on XZ — camera is pure top-down (+Y).
  return (
    <group position={[0, 0, 0]} rotation={[0, 0, 0]} scale={1.35}>
      <group ref={spinRef}>
        <primitive object={scene} />
      </group>
    </group>
  )
}

useGLTF.preload(GLB)
