import { useRef, useState } from 'react'
import { createPortal, useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { easing } from 'maath'
import { dragActiveOrRecent, markDragEnd, useStore } from '../../state/store'
import { engine } from '../../audio/engine'
import { useSceneModel } from '../SceneModel'
import {
  ARM,
  GROOVE_IN,
  GROOVE_OUT,
  PLAYER_POS,
  PLATTER,
  YAW_CENTER,
  progressToRadius,
  radiusAtYaw,
  radiusToProgress,
  yawAtRadius,
} from '../layout'

const DRAG_PLANE = new THREE.Plane(
  new THREE.Vector3(0, 1, 0),
  -(PLAYER_POS.y + PLATTER.topLocalY),
)
const hit = new THREE.Vector3()

const PITCH = { rest: -0.015, lifted: -0.075, down: 0.012 }
const DROP_DAMP = 0.11
const GROOVE_DAMP = 0.18

/** Visual arm is in room.glb; this component drives pivot rotation + drag collider. */
export function Tonearm() {
  const { nodes } = useSceneModel()
  const pivot = nodes.tonearm_pivot
  const playerRoot = nodes.player_root
  const cur = useRef({ yaw: ARM.yawRest, pitch: PITCH.rest })
  const dragYaw = useRef(ARM.yawRest)
  const dropYaw = useRef(ARM.yawRest)
  const [hover, setHover] = useState(false)
  const [baseHover, setBaseHover] = useState(false)
  const dragging = useStore((s) => s.draggingTonearm)
  useCursor(dragging || hover || baseHover, dragging ? 'grabbing' : baseHover ? 'pointer' : 'grab')

  const toggleArmView = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (dragActiveOrRecent()) return
    const s = useStore.getState()
    s.setView(s.view === 'arm' ? 'player' : 'arm')
  }

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    const s = useStore.getState()
    if (s.recordPhase !== 'onPlatter') return
    e.stopPropagation()
    try {
      ;(e.target as Element).setPointerCapture(e.pointerId)
    } catch {
      /* synthetic pointers can't always be captured */
    }
    dragYaw.current = cur.current.yaw
    s.setDraggingTonearm(true)
    if (s.needle === 'down') {
      engine.liftNeedle()
      s.setNeedle('rest')
    }
  }

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!useStore.getState().draggingTonearm) return
    e.stopPropagation()
    if (!e.ray.intersectPlane(DRAG_PLANE, hit)) return
    const lx = hit.x - PLAYER_POS.x
    const lz = hit.z - PLAYER_POS.z
    const yaw = Math.atan2(lx - ARM.pivotLocal.x, lz - ARM.pivotLocal.z)
    dragYaw.current = THREE.MathUtils.clamp(yaw, YAW_CENTER, ARM.yawRest + 0.12)
  }

  const onUp = (e: ThreeEvent<PointerEvent>) => {
    const s = useStore.getState()
    if (!s.draggingTonearm) return
    e.stopPropagation()
    try {
      ;(e.target as Element).releasePointerCapture(e.pointerId)
    } catch {
      /* capture may already be gone */
    }
    s.setDraggingTonearm(false)
    markDragEnd()
    const r = radiusAtYaw(dragYaw.current)
    if (s.recordPhase === 'onPlatter' && r <= GROOVE_OUT + 0.01 && r >= GROOVE_IN - 0.006) {
      s.setNeedle('down')
      engine.dropNeedle(radiusToProgress(r))
      dropYaw.current = dragYaw.current
    } else {
      s.setNeedle('rest')
      engine.playSfx('needleLift', 0.3, 1.4)
    }
  }

  useFrame((_, dt) => {
    if (!pivot) return
    pivot.rotation.order = 'YXZ'
    const s = useStore.getState()
    let yaw = ARM.yawRest
    let pitch = PITCH.rest
    if (s.draggingTonearm) {
      yaw = dragYaw.current
      pitch = PITCH.lifted
      easing.damp(cur.current, 'yaw', yaw, 0.08, dt)
      easing.damp(cur.current, 'pitch', pitch, 0.16, dt)
    } else if (s.needle === 'down') {
      yaw = engine.seekReady
        ? yawAtRadius(progressToRadius(engine.getProgress()))
        : dropYaw.current
      pitch = PITCH.down
      easing.damp(cur.current, 'yaw', yaw, engine.seekReady ? GROOVE_DAMP : DROP_DAMP, dt)
      easing.damp(cur.current, 'pitch', pitch, 0.2, dt)
    } else {
      easing.damp(cur.current, 'yaw', yaw, 0.25, dt)
      easing.damp(cur.current, 'pitch', pitch, 0.16, dt)
    }
    pivot.rotation.set(cur.current.pitch, cur.current.yaw, 0)
  })

  if (!pivot || !playerRoot) return null

  return (
    <>
      {createPortal(
        <group
          onClick={toggleArmView}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerOver={(e) => {
            e.stopPropagation()
            setBaseHover(true)
          }}
          onPointerOut={() => setBaseHover(false)}
        >
          <mesh visible={false}>
            <cylinderGeometry args={[0.022, 0.022, 0.05, 16]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>
        </group>,
        nodes['arm-base'] ?? playerRoot,
      )}
      {createPortal(
        <group
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerOver={() => setHover(true)}
          onPointerOut={() => setHover(false)}
        >
          <mesh position={[0, 0.01, 0.07 + (ARM.length - 0.07) / 2]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.02, 0.02, ARM.length - 0.07, 8]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>
        </group>,
        pivot,
      )}
    </>
  )
}
