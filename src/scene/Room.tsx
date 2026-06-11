import { useMemo } from 'react'
import { ContactShadows } from '@react-three/drei'
import { requestUnfocus } from '../state/store'
import { woodTexture } from './textures'
import { DESK, ROOM } from './layout'

export function Room() {
  const floorTex = useMemo(() => woodTexture(5, 5, true), [])
  const deskTex = useMemo(() => woodTexture(2, 1), [])

  const toOverview = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    requestUnfocus()
  }

  return (
    <group>
      {/* floor */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow onClick={toOverview}>
        <planeGeometry args={[ROOM.w, ROOM.d]} />
        <meshStandardMaterial map={floorTex} roughness={0.7} />
      </mesh>
      <ContactShadows position={[0, 0.005, -1.2]} opacity={0.4} scale={6} blur={2.4} far={2} resolution={512} frames={1} />

      {/* walls */}
      <mesh position={[0, ROOM.h / 2, ROOM.backZ]} onClick={toOverview} receiveShadow>
        <planeGeometry args={[ROOM.w, ROOM.h]} />
        <meshStandardMaterial color="#efece5" roughness={0.95} />
      </mesh>
      <mesh position={[-ROOM.w / 2, ROOM.h / 2, 0]} rotation-y={Math.PI / 2} onClick={toOverview}>
        <planeGeometry args={[ROOM.d + 2, ROOM.h]} />
        <meshStandardMaterial color="#ece9e2" roughness={0.95} />
      </mesh>
      <mesh position={[ROOM.w / 2, ROOM.h / 2, 0]} rotation-y={-Math.PI / 2} onClick={toOverview}>
        <planeGeometry args={[ROOM.d + 2, ROOM.h]} />
        <meshStandardMaterial color="#ece9e2" roughness={0.95} />
      </mesh>
      <mesh position={[0, ROOM.h, 0]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[ROOM.w, ROOM.d + 2]} />
        <meshStandardMaterial color="#efece6" emissive="#b8b4ac" emissiveIntensity={0.55} roughness={1} />
      </mesh>
      {/* skirting board on the back wall */}
      <mesh position={[0, 0.045, ROOM.backZ + 0.008]}>
        <boxGeometry args={[ROOM.w, 0.09, 0.014]} />
        <meshStandardMaterial color="#e2dfd8" roughness={0.8} />
      </mesh>

      {/* desk */}
      <group position={[DESK.x, 0, DESK.z]}>
        <mesh position={[0, DESK.topY - 0.025, 0]} castShadow receiveShadow>
          <boxGeometry args={[DESK.w, 0.05, DESK.d]} />
          <meshStandardMaterial map={deskTex} roughness={0.55} />
        </mesh>
        {[-1, 1].map((sx) =>
          [-1, 1].map((sz) => (
            <mesh
              key={`${sx}${sz}`}
              position={[sx * (DESK.w / 2 - 0.07), (DESK.topY - 0.05) / 2, sz * (DESK.d / 2 - 0.07)]}
              castShadow
            >
              <cylinderGeometry args={[0.016, 0.016, DESK.topY - 0.05, 16]} />
              <meshStandardMaterial color="#9a9a98" metalness={0.8} roughness={0.35} />
            </mesh>
          )),
        )}
      </group>
    </group>
  )
}
