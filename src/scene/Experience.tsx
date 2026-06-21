import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { requestUnfocus, useStore } from '../state/store'
import { engine } from '../audio/engine'
import { STATIONS } from './layout'
import { sampleAtmosphere } from './dayNight'
import { Lighting } from './Lighting'
import { Room } from './Room'
import { CameraRig } from './CameraRig'
import { Player } from './Player/Player'
import { Shelf } from './Shelf/Shelf'
import { RecordTransit } from './RecordTransit'

function EngineUpdater() {
  useFrame((_, dt) => engine.update(Math.min(dt, 0.1)))
  return null
}

function SceneBackground() {
  const scene = useThree((s) => s.scene)
  useFrame(() => {
    const bg = sampleAtmosphere(useStore.getState().dayPhase).background
    if (scene.background instanceof THREE.Color) scene.background.copy(bg)
    else scene.background = bg.clone()
  })
  return null
}

function AtmospherePost() {
  const dayPhase = useStore((s) => s.dayPhase)
  const a = sampleAtmosphere(dayPhase)
  return (
    <EffectComposer multisampling={4}>
      <Bloom intensity={a.bloomIntensity} luminanceThreshold={a.bloomThreshold} mipmapBlur />
      <Vignette eskil={false} offset={a.vignetteOffset} darkness={a.vignetteDarkness} />
    </EffectComposer>
  )
}

export function Experience() {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: 40, position: STATIONS.overview.pos.toArray(), near: 0.05, far: 30 }}
      onCreated={({ gl }) => {
        gl.shadowMap.enabled = true
        gl.shadowMap.type = THREE.PCFShadowMap
      }}
      onPointerMissed={() => requestUnfocus()}
    >
      <SceneBackground />
      <Lighting />
      <Room />
      <Player />
      <Shelf />
      <RecordTransit />
      <CameraRig />
      <EngineUpdater />
      <AtmospherePost />
    </Canvas>
  )
}
