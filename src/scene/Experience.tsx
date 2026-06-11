import { Canvas, useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { useStore } from '../state/store'
import { engine } from '../audio/engine'
import { STATIONS } from './layout'
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

export function Experience() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: 40, position: STATIONS.overview.pos.toArray(), near: 0.05, far: 30 }}
      onPointerMissed={() => useStore.getState().setView('overview')}
    >
      <color attach="background" args={['#e8e4dc']} />
      <Lighting />
      <Room />
      <Player />
      <Shelf />
      <RecordTransit />
      <CameraRig />
      <EngineUpdater />
      <EffectComposer multisampling={4}>
        <Bloom intensity={0.18} luminanceThreshold={1.0} mipmapBlur />
        <Vignette eskil={false} offset={0.22} darkness={0.42} />
      </EffectComposer>
    </Canvas>
  )
}
