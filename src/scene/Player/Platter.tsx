import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { engine } from '../../audio/engine'
import { BODY, PLATTER } from '../layout'

export function Platter() {
  const spin = useRef<THREE.Group>(null)
  useFrame(() => {
    if (spin.current) spin.current.rotation.y = engine.platterAngle
  })

  const h = PLATTER.topLocalY - BODY.h

  return (
    <group position={[PLATTER.local.x, BODY.h, PLATTER.local.y]}>
      <group ref={spin}>
        {/* platter */}
        <mesh position-y={h / 2} castShadow>
          <cylinderGeometry args={[PLATTER.r, PLATTER.r * 0.985, h, 64]} />
          <meshStandardMaterial color="#c9c7c2" metalness={0.75} roughness={0.3} />
        </mesh>
        {/* rubber mat */}
        <mesh position-y={h + 0.0011}>
          <cylinderGeometry args={[PLATTER.r * 0.97, PLATTER.r * 0.97, 0.0022, 64]} />
          <meshStandardMaterial color="#1c1c1e" roughness={0.92} />
        </mesh>
        {/* strobe dots on the rim */}
        <mesh position-y={h - 0.004}>
          <cylinderGeometry args={[PLATTER.r + 0.0005, PLATTER.r + 0.0005, 0.003, 64, 1, true]} />
          <meshStandardMaterial color="#8e8c88" metalness={0.6} roughness={0.5} />
        </mesh>
      </group>
      {/* spindle (static) */}
      <mesh position-y={h + 0.006}>
        <cylinderGeometry args={[0.0035, 0.0035, 0.014, 16]} />
        <meshStandardMaterial color="#b8b6b2" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  )
}
