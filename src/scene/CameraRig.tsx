import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { easing } from 'maath'
import { useStore } from '../state/store'
import { STATIONS } from './layout'

export function CameraRig() {
  const camera = useThree((s) => s.camera)
  const view = useStore((s) => s.view)
  const dragging = useStore((s) => s.draggingTonearm)
  const pos = useRef(STATIONS.overview.pos.clone())
  const target = useRef(STATIONS.overview.target.clone())
  const goal = useRef(new THREE.Vector3())

  useFrame((state, dt) => {
    const station = STATIONS[view]
    const px = dragging ? 0 : state.pointer.x
    const py = dragging ? 0 : state.pointer.y
    goal.current.set(station.pos.x + px * 0.07, station.pos.y + py * 0.045, station.pos.z)
    easing.damp3(pos.current, goal.current, 0.55, dt)
    goal.current.set(station.target.x + px * 0.015, station.target.y + py * 0.01, station.target.z)
    easing.damp3(target.current, goal.current, 0.55, dt)
    camera.position.copy(pos.current)
    camera.lookAt(target.current)
    if (import.meta.env.DEV) {
      ;(window as unknown as { __proj: (x: number, y: number, z: number) => number[] }).__proj = (x, y, z) => {
        const v = new THREE.Vector3(x, y, z).project(camera)
        return [((v.x + 1) / 2) * window.innerWidth, ((1 - v.y) / 2) * window.innerHeight]
      }
    }
  })

  return null
}
