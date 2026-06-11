import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { easing } from 'maath'
import { useStore } from '../../state/store'
import { engine } from '../../audio/engine'
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
  needleXZ,
} from '../layout'

const DRAG_PLANE = new THREE.Plane(
  new THREE.Vector3(0, 1, 0),
  -(PLAYER_POS.y + PLATTER.topLocalY), // y = platter top in world space
)
const hit = new THREE.Vector3()

const PITCH = { rest: -0.015, lifted: -0.075, down: 0.012 }

export function Tonearm() {
  const arm = useRef<THREE.Group>(null)
  const cur = useRef({ yaw: ARM.yawRest, pitch: PITCH.rest })
  const dragYaw = useRef(ARM.yawRest)
  const [hover, setHover] = useState(false)
  const dragging = useStore((s) => s.draggingTonearm)
  useCursor(hover || dragging, dragging ? 'grabbing' : 'grab')

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    const s = useStore.getState()
    if (s.recordPhase !== 'onPlatter') return
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
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
    s.setDraggingTonearm(false)
    const r = radiusAtYaw(dragYaw.current)
    if (s.recordPhase === 'onPlatter' && r <= GROOVE_OUT + 0.01 && r >= GROOVE_IN - 0.006) {
      s.setNeedle('down')
      engine.dropNeedle(radiusToProgress(r))
    } else {
      s.setNeedle('rest')
      engine.playSfx('needleLift', 0.3, 1.4) // settle back on the armrest
    }
  }

  useFrame((_, dt) => {
    if (!arm.current) return
    const s = useStore.getState()
    let yaw = ARM.yawRest
    let pitch = PITCH.rest
    if (s.draggingTonearm) {
      yaw = dragYaw.current
      pitch = PITCH.lifted
    } else if (s.needle === 'down') {
      yaw = yawAtRadius(progressToRadius(engine.getProgress()))
      pitch = PITCH.down
    }
    easing.damp(cur.current, 'yaw', yaw, s.draggingTonearm ? 0.08 : 0.25, dt)
    easing.damp(cur.current, 'pitch', pitch, 0.16, dt)
    arm.current.rotation.set(cur.current.pitch, cur.current.yaw, 0)
  })

  const rest = needleXZ(ARM.yawRest)

  return (
    <group position={ARM.pivotLocal.toArray()}>
      {/* bearing base */}
      <mesh position-y={-0.002} castShadow>
        <cylinderGeometry args={[0.018, 0.021, 0.024, 32]} />
        <meshStandardMaterial color="#b9b7b3" metalness={0.85} roughness={0.25} />
      </mesh>

      {/* rotating assembly; rotation order YXZ so pitch follows yaw */}
      <group ref={arm} rotation-order="YXZ">
        <group
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerOver={() => setHover(true)}
          onPointerOut={() => setHover(false)}
        >
          {/* arm tube */}
          <mesh position={[0, 0.012, ARM.length / 2 - 0.01]} rotation-x={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.0042, 0.0042, ARM.length - 0.02, 16]} />
            <meshStandardMaterial color="#d6d4d0" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* headshell */}
          <mesh position={[0, 0.006, ARM.length - 0.012]} castShadow>
            <boxGeometry args={[0.016, 0.013, 0.034]} />
            <meshStandardMaterial color="#2a2a2c" roughness={0.5} />
          </mesh>
          {/* stylus */}
          <mesh position={[0, -0.0035, ARM.length - 0.004]}>
            <coneGeometry args={[0.0018, 0.006, 8]} />
            <meshStandardMaterial color="#888" metalness={0.7} roughness={0.3} />
          </mesh>
          {/* counterweight */}
          <mesh position={[0, 0.012, -0.04]} rotation-x={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.013, 0.013, 0.024, 24]} />
            <meshStandardMaterial color="#3a3a3c" metalness={0.8} roughness={0.35} />
          </mesh>
          {/* pivot column */}
          <mesh position-y={0.011}>
            <cylinderGeometry args={[0.007, 0.007, 0.026, 16]} />
            <meshStandardMaterial color="#c9c7c3" metalness={0.85} roughness={0.25} />
          </mesh>
          {/* invisible fat grab-helper along the tube */}
          <mesh position={[0, 0.01, ARM.length / 2]} rotation-x={Math.PI / 2} visible={false}>
            <cylinderGeometry args={[0.02, 0.02, ARM.length, 8]} />
          </mesh>
        </group>
      </group>

      {/* armrest post (in player space, near the needle's rest point) */}
      <group position={[rest.x - ARM.pivotLocal.x, 0, rest.y - ARM.pivotLocal.z]}>
        <mesh position-y={-0.006}>
          <cylinderGeometry args={[0.004, 0.004, 0.018, 12]} />
          <meshStandardMaterial color="#9a9894" metalness={0.7} roughness={0.4} />
        </mesh>
        <mesh position-y={0.004}>
          <boxGeometry args={[0.012, 0.005, 0.018]} />
          <meshStandardMaterial color="#9a9894" metalness={0.7} roughness={0.4} />
        </mesh>
      </group>
    </group>
  )
}
