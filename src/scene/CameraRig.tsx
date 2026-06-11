import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { easing } from 'maath'
import { useStore } from '../state/store'
import { PARALLAX, STATIONS } from './layout'

export function CameraRig() {
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const view = useStore((s) => s.view)
  const dragging = useStore((s) => s.draggingTonearm)
  const pos = useRef(STATIONS.overview.pos.clone())
  const target = useRef(STATIONS.overview.target.clone())
  const goal = useRef(new THREE.Vector3())

  useFrame((state, dt) => {
    const station = STATIONS[view]
    const [ap, at] = PARALLAX[view]
    const px = dragging ? 0 : state.pointer.x
    const py = dragging ? 0 : state.pointer.y
    goal.current.set(station.pos.x + px * ap, station.pos.y + py * ap * 0.64, station.pos.z)
    easing.damp3(pos.current, goal.current, 0.55, dt)
    goal.current.set(station.target.x + px * at, station.target.y + py * at * 0.64, station.target.z)
    easing.damp3(target.current, goal.current, 0.55, dt)
    camera.position.copy(pos.current)
    camera.lookAt(target.current)
    if (import.meta.env.DEV) {
      const w = window as unknown as {
        __proj: (x: number, y: number, z: number) => number[]
        __hits: (cx: number, cy: number) => string[]
      }
      w.__proj = (x, y, z) => {
        const v = new THREE.Vector3(x, y, z).project(camera)
        return [((v.x + 1) / 2) * window.innerWidth, ((1 - v.y) / 2) * window.innerHeight]
      }
      w.__hits = (cx, cy) => {
        const ray = new THREE.Raycaster()
        ray.setFromCamera(
          new THREE.Vector2((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1),
          camera,
        )
        return ray
          .intersectObjects(scene.children, true)
          .slice(0, 8)
          .map((h) => h.object.name || `${h.object.type}(${(h.object as THREE.Mesh).geometry?.type ?? ''})`)
      }
    }
  })

  return null
}
