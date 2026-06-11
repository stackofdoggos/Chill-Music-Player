import { RoundedBox } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useStore } from '../../state/store'
import { BODY, PLAYER_POS } from '../layout'
import { Platter } from './Platter'
import { Tonearm } from './Tonearm'
import { Knobs } from './Knobs'
import { Lid } from './Lid'

export function Player() {
  const setView = useStore((s) => s.setView)

  const focus = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    setView('player')
  }

  return (
    <group position={PLAYER_POS.toArray()}>
      {/* chassis */}
      <RoundedBox
        args={[BODY.w, BODY.h, BODY.d]}
        radius={0.007}
        smoothness={4}
        position-y={BODY.h / 2}
        castShadow
        receiveShadow
        onClick={focus}
      >
        <meshStandardMaterial color="#f4f2ed" metalness={0.15} roughness={0.45} />
      </RoundedBox>
      {/* deck top plate, slightly inset */}
      <mesh position-y={BODY.h + 0.0006} onClick={focus} receiveShadow>
        <boxGeometry args={[BODY.w - 0.02, 0.0012, BODY.d - 0.02]} />
        <meshStandardMaterial color="#eceae5" metalness={0.3} roughness={0.35} />
      </mesh>
      {/* feet */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (BODY.w / 2 - 0.04), -0.008, sz * (BODY.d / 2 - 0.04)]}>
            <cylinderGeometry args={[0.014, 0.016, 0.016, 20]} />
            <meshStandardMaterial color="#2c2c2e" roughness={0.7} />
          </mesh>
        )),
      )}
      <Platter />
      <Tonearm />
      <Knobs />
      <Lid />
    </group>
  )
}
