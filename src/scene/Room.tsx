import { useMemo, useRef, Suspense } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { useFrame } from '@react-three/fiber'
import type { MeshStandardMaterial } from 'three'
import { requestUnfocus, useStore } from '../state/store'
import { engine } from '../audio/engine'
import { woodTexture } from './textures'
import { DESK, isShelfFocusPoint, ROOM } from './layout'
import { sampleAtmosphere } from './dayNight'
import { WallArt } from './WallArt'

export function Room() {
  const floorTex = useMemo(() => woodTexture(5, 5, true), [])
  const deskTex = useMemo(() => woodTexture(2, 1), [])

  const backWallMat = useRef<MeshStandardMaterial>(null)
  const leftWallMat = useRef<MeshStandardMaterial>(null)
  const rightWallMat = useRef<MeshStandardMaterial>(null)
  const ceilingMat = useRef<MeshStandardMaterial>(null)
  const windowMat = useRef<MeshStandardMaterial>(null)

  useFrame(() => {
    const a = sampleAtmosphere(useStore.getState().dayPhase)
    for (const ref of [backWallMat, leftWallMat, rightWallMat]) {
      if (ref.current) ref.current.color.copy(a.wallColor)
    }
    if (ceilingMat.current) {
      ceilingMat.current.emissive.copy(a.ceilingEmissive)
      ceilingMat.current.emissiveIntensity = a.ceilingEmissiveIntensity
    }
    if (windowMat.current) {
      windowMat.current.emissive.copy(a.windowEmissive)
      windowMat.current.emissiveIntensity = a.windowEmissiveIntensity
    }
  })

  const toOverview = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    requestUnfocus()
  }

  const onBackWallClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (isShelfFocusPoint(e.point.x, e.point.y)) {
      const action = useStore.getState().clickShelfBackdrop()
      if (action === 'putBack') engine.playSfx('sleeveIn', 0.85, 1.05)
      return
    }
    requestUnfocus()
  }

  return (
    <group>
      {/* floor */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow onClick={toOverview}>
        <planeGeometry args={[ROOM.w, ROOM.d]} />
        <meshStandardMaterial map={floorTex} roughness={0.7} />
      </mesh>

      {/* walls */}
      <mesh position={[0, ROOM.h / 2, ROOM.backZ]} onClick={onBackWallClick} receiveShadow>
        <planeGeometry args={[ROOM.w, ROOM.h]} />
        <meshStandardMaterial ref={backWallMat} color="#ece9e2" roughness={0.95} />
      </mesh>
      <mesh position={[-ROOM.w / 2, ROOM.h / 2, 0]} rotation-y={Math.PI / 2} onClick={toOverview}>
        <planeGeometry args={[ROOM.d + 2, ROOM.h]} />
        <meshStandardMaterial ref={leftWallMat} color="#ece9e2" roughness={0.95} />
      </mesh>
      <mesh position={[ROOM.w / 2, ROOM.h / 2, 0]} rotation-y={-Math.PI / 2} onClick={toOverview}>
        <planeGeometry args={[ROOM.d + 2, ROOM.h]} />
        <meshStandardMaterial ref={rightWallMat} color="#ece9e2" roughness={0.95} />
      </mesh>
      <mesh position={[0, ROOM.h, 0]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[ROOM.w, ROOM.d + 2]} />
        <meshStandardMaterial ref={ceilingMat} color="#efece6" emissive="#b8b4ac" emissiveIntensity={0.55} roughness={1} />
      </mesh>

      {/* afternoon sun through the right-hand window — drives golden-hour bloom */}
      <mesh position={[ROOM.w / 2 - 0.012, 1.45, -0.55]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[1.35, 1.05]} />
        <meshStandardMaterial
          ref={windowMat}
          color="#fff8f0"
          emissive="#ffb040"
          emissiveIntensity={1.65}
          roughness={0.35}
          metalness={0}
        />
      </mesh>

      {/* skirting board on the back wall */}
      <mesh position={[0, 0.045, ROOM.backZ + 0.008]}>
        <boxGeometry args={[ROOM.w, 0.09, 0.014]} />
        <meshStandardMaterial color="#e2dfd8" roughness={0.8} />
      </mesh>

      <Suspense fallback={null}>
        <WallArt />
      </Suspense>

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
