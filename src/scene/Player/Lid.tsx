import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { easing } from 'maath'
import { useStore } from '../../state/store'
import { engine } from '../../audio/engine'
import { BODY } from '../layout'

const LID = { w: 0.565, h: 0.105, d: 0.348 }

export function Lid() {
  const hinge = useRef<THREE.Group>(null)
  const lidOpen = useStore((s) => s.lidOpen)
  const phase = useStore((s) => s.recordPhase)
  const [hover, setHover] = useState(false)
  useCursor(hover)

  // auto-open so the record can fly in
  useEffect(() => {
    if (phase === 'toPlatter' && !useStore.getState().lidOpen) {
      useStore.getState().setLid(true)
      engine.playSfx('lid', 0.7)
    }
  }, [phase])

  const toggle = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const s = useStore.getState()
    s.setLid(!s.lidOpen)
    engine.playSfx('lid', 0.7, s.lidOpen ? 0.9 : 1.05)
  }

  useFrame((_, dt) => {
    if (hinge.current) easing.damp(hinge.current.rotation, 'x', lidOpen ? -1.45 : 0, 0.4, dt)
  })

  return (
    <group ref={hinge} position={[0, BODY.h + 0.001, -BODY.d / 2 + 0.006]}>
      <group
        position={[0, LID.h / 2, BODY.d / 2 - 0.006]}
        onClick={toggle}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
        }}
        onPointerOut={() => setHover(false)}
      >
        <mesh castShadow>
          <boxGeometry args={[LID.w, LID.h, LID.d]} />
          <meshPhysicalMaterial
            color="#dfe4e6"
            transparent
            opacity={0.16}
            roughness={0.08}
            metalness={0}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* subtle top edge highlight so the acrylic reads */}
        <mesh position-y={LID.h / 2}>
          <boxGeometry args={[LID.w, 0.0015, LID.d]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.35} roughness={0.1} />
        </mesh>
      </group>
    </group>
  )
}
