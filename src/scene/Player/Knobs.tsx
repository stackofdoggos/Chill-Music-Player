import { useEffect, useRef, useState } from 'react'
import { createPortal, useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { easing } from 'maath'
import { dragActiveOrRecent, markDragEnd, useStore } from '../../state/store'
import { engine } from '../../audio/engine'
import { useSceneModel } from '../SceneModel'
import { BODY } from '../layout'

const FACE_Z = BODY.d / 2
const Y = BODY.h * 0.5
const SPEED_X = 0.155

function applyVolume(v: number) {
  const st = useStore.getState()
  const clamped = THREE.MathUtils.clamp(v, 0, 1)
  if (clamped === st.volume) return
  st.setVolume(clamped)
  engine.setVolume(clamped)
}

function PowerSwitch() {
  const { nodes } = useSceneModel()
  const pivot = nodes.switch_power
  const lever = nodes.switch_lever
  const power = useStore((s) => s.power)
  const [hover, setHover] = useState(false)
  useCursor(hover)

  const toggle = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (dragActiveOrRecent()) return
    const s = useStore.getState()
    s.setPower(!s.power)
    engine.setPower(!power)
  }

  useFrame((_, dt) => {
    if (lever) easing.damp(lever.rotation, 'x', power ? -0.55 : 0.55, 0.08, dt)
    const mat = (lever as THREE.Mesh | undefined)?.material as THREE.MeshStandardMaterial | undefined
    if (mat) mat.color.set(power ? '#e0552c' : '#2e2e30')
  })

  if (!pivot) return null
  return createPortal(
    <mesh visible={false} onClick={toggle} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
      <boxGeometry args={[0.04, 0.05, 0.03]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>,
    pivot,
  )
}

function SpeedKnob() {
  const { nodes } = useSceneModel()
  const pivot = nodes.knob_speed
  const playerRoot = nodes.player_root
  const speed = useStore((s) => s.speed)
  const [hover, setHover] = useState(false)
  useCursor(hover)

  const toggle = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (dragActiveOrRecent()) return
    const s = useStore.getState()
    const next = s.speed === 33 ? 45 : 33
    s.setSpeed(next)
    engine.setSpeed(next)
    engine.playSfx('knobTick', 0.9, 0.8)
  }

  useFrame((_, dt) => {
    if (pivot) easing.damp(pivot.rotation, 'z', speed === 33 ? 0.4 : -0.4, 0.07, dt)
  })

  if (!pivot || !playerRoot) return null
  return (
    <>
      {createPortal(
        <>
          {/* black tick on the speed knob face — sits just proud of the GLB mesh cap */}
          <mesh position={[0, 0.0055, 0.0155]}>
            <boxGeometry args={[0.0014, 0.009, 0.0006]} />
            <meshStandardMaterial color="#2e2e30" roughness={0.5} />
          </mesh>
          <mesh visible={false} onClick={toggle} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
            <cylinderGeometry args={[0.03, 0.03, 0.02, 16]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>
        </>,
        pivot,
      )}
      {createPortal(
        <>
          <mesh position={[SPEED_X - 0.0095, Y + 0.021, FACE_Z]}>
            <sphereGeometry args={[0.0016, 8, 8]} />
            <meshStandardMaterial color="#5a5a5c" />
          </mesh>
          <mesh position={[SPEED_X + 0.0095, Y + 0.021, FACE_Z]}>
            <sphereGeometry args={[0.0016, 8, 8]} />
            <meshStandardMaterial color="#e0552c" />
          </mesh>
        </>,
        playerRoot,
      )}
    </>
  )
}

function VolumeKnob() {
  const { nodes } = useSceneModel()
  const pivot = nodes.knob_volume
  const volume = useStore((s) => s.volume)
  const view = useStore((s) => s.view)
  const [hover, setHover] = useState(false)
  const drag = useRef<{ startY: number; startV: number; step: number } | null>(null)
  const moved = useRef(false)
  useCursor(hover, drag.current ? 'grabbing' : 'grab')

  useEffect(() => {
    if (view !== 'volume') return
    const onKey = (e: KeyboardEvent) => {
      const dir =
        e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -1 : 0
      if (!dir) return
      e.preventDefault()
      const v = useStore.getState().volume + dir / 18
      applyVolume(v)
      engine.playSfx('knobTick', 0.5, 1 + v * 0.3)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view])

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (moved.current) {
      moved.current = false
      return
    }
    if (dragActiveOrRecent()) return
    if (useStore.getState().view !== 'volume') useStore.getState().setView('volume')
  }

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const s = useStore.getState()
    moved.current = false
    drag.current = { startY: e.clientY, startV: s.volume, step: Math.round(s.volume * 18) }
    const move = (ev: PointerEvent) => {
      if (!drag.current) return
      if (Math.abs(ev.clientY - drag.current.startY) > 4) moved.current = true
      const v = THREE.MathUtils.clamp(drag.current.startV - (ev.clientY - drag.current.startY) * 0.004, 0, 1)
      applyVolume(v)
      const step = Math.round(v * 18)
      if (step !== drag.current.step) {
        drag.current.step = step
        engine.playSfx('knobTick', 0.5, 1 + v * 0.3)
      }
    }
    const up = () => {
      drag.current = null
      if (moved.current) markDragEnd()
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  useFrame((_, dt) => {
    if (pivot) easing.damp(pivot.rotation, 'z', THREE.MathUtils.lerp(2.2, -2.2, volume), 0.06, dt)
  })

  if (!pivot) return null
  return createPortal(
    <>
      <mesh rotation-x={Math.PI / 2} position-z={0.0092}>
        <torusGeometry args={[0.016, 0.0018, 12, 48]} />
        <meshStandardMaterial color="#c2c0bc" metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.0055, 0.0195]}>
        <boxGeometry args={[0.0026, 0.014, 0.0014]} />
        <meshStandardMaterial color="#2e2e30" roughness={0.5} />
      </mesh>
      <mesh
        visible={false}
        onClick={onClick}
        onPointerDown={onDown}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <cylinderGeometry args={[0.04, 0.04, 0.03, 16]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </>,
    pivot,
  )
}

/** Knob visuals live in room.glb; empties are rotated here. Dial markings are code-driven. */
export function Knobs() {
  return (
    <>
      <PowerSwitch />
      <SpeedKnob />
      <VolumeKnob />
    </>
  )
}
