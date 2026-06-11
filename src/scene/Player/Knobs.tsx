import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { easing } from 'maath'
import { useStore } from '../../state/store'
import { engine } from '../../audio/engine'
import { BODY } from '../layout'

const FACE_Z = BODY.d / 2
const Y = BODY.h * 0.5

const ALU = { color: '#dad8d4', metalness: 0.85, roughness: 0.3 }

function PowerSwitch() {
  const power = useStore((s) => s.power)
  const lever = useRef<THREE.Mesh>(null)
  const [hover, setHover] = useState(false)
  useCursor(hover)

  const toggle = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const s = useStore.getState()
    s.setPower(!s.power)
    engine.setPower(!power)
  }

  useFrame((_, dt) => {
    if (lever.current) easing.damp(lever.current.rotation, 'x', power ? -0.55 : 0.55, 0.08, dt)
  })

  return (
    <group
      position={[0.09, Y, FACE_Z]}
      onClick={toggle}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <mesh>
        <boxGeometry args={[0.022, 0.034, 0.004]} />
        <meshStandardMaterial color="#bdbbb7" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh ref={lever} position-z={0.004}>
        <boxGeometry args={[0.012, 0.008, 0.014]} />
        <meshStandardMaterial color={power ? '#e0552c' : '#2e2e30'} roughness={0.45} />
      </mesh>
    </group>
  )
}

function SpeedKnob() {
  const speed = useStore((s) => s.speed)
  const knob = useRef<THREE.Group>(null)
  const [hover, setHover] = useState(false)
  useCursor(hover)

  const toggle = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const s = useStore.getState()
    const next = s.speed === 33 ? 45 : 33
    s.setSpeed(next)
    engine.setSpeed(next)
    engine.playSfx('knobTick', 0.9, 0.8)
  }

  useFrame((_, dt) => {
    if (knob.current) easing.damp(knob.current.rotation, 'z', speed === 33 ? 0.4 : -0.4, 0.07, dt)
  })

  return (
    <group
      position={[0.155, Y, FACE_Z]}
      onClick={toggle}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <group ref={knob}>
        <mesh rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.0155, 0.0155, 0.014, 32]} />
          <meshStandardMaterial {...ALU} />
        </mesh>
        <mesh position={[0, 0.0095, 0.0072]}>
          <boxGeometry args={[0.0022, 0.011, 0.0012]} />
          <meshStandardMaterial color="#2e2e30" roughness={0.5} />
        </mesh>
      </group>
      {/* 33 / 45 position dots */}
      <mesh position={[-0.0095, 0.021, 0]}>
        <sphereGeometry args={[0.0016, 8, 8]} />
        <meshStandardMaterial color="#5a5a5c" />
      </mesh>
      <mesh position={[0.0095, 0.021, 0]}>
        <sphereGeometry args={[0.0016, 8, 8]} />
        <meshStandardMaterial color="#e0552c" />
      </mesh>
    </group>
  )
}

function VolumeKnob() {
  const volume = useStore((s) => s.volume)
  const knob = useRef<THREE.Group>(null)
  const [hover, setHover] = useState(false)
  const drag = useRef<{ startY: number; startV: number; step: number } | null>(null)
  useCursor(hover, drag.current ? 'grabbing' : 'grab')

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const s = useStore.getState()
    drag.current = { startY: e.clientY, startV: s.volume, step: Math.round(s.volume * 18) }
    const move = (ev: PointerEvent) => {
      if (!drag.current) return
      const v = THREE.MathUtils.clamp(drag.current.startV - (ev.clientY - drag.current.startY) * 0.004, 0, 1)
      const st = useStore.getState()
      st.setVolume(v)
      engine.setVolume(v)
      const step = Math.round(v * 18)
      if (step !== drag.current.step) {
        drag.current.step = step
        engine.playSfx('knobTick', 0.5, 1 + v * 0.3)
      }
    }
    const up = () => {
      drag.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  useFrame((_, dt) => {
    if (knob.current) easing.damp(knob.current.rotation, 'z', THREE.MathUtils.lerp(2.2, -2.2, volume), 0.06, dt)
  })

  return (
    <group
      position={[0.235, Y, FACE_Z]}
      onPointerDown={onDown}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <group ref={knob}>
        <mesh rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.024, 0.024, 0.018, 48]} />
          <meshStandardMaterial {...ALU} />
        </mesh>
        {/* finger dimple ring */}
        <mesh rotation-x={Math.PI / 2} position-z={0.0092}>
          <torusGeometry args={[0.016, 0.0018, 12, 48]} />
          <meshStandardMaterial color="#c2c0bc" metalness={0.8} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.016, 0.0095]}>
          <boxGeometry args={[0.0026, 0.014, 0.0014]} />
          <meshStandardMaterial color="#2e2e30" roughness={0.5} />
        </mesh>
      </group>
    </group>
  )
}

export function Knobs() {
  return (
    <>
      <PowerSwitch />
      <SpeedKnob />
      <VolumeKnob />
    </>
  )
}
