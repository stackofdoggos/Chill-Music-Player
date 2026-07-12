import { Suspense, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import { requestUnfocus, useStore } from '../state/store'
import { useSettings } from '../state/settings'
import { engine } from '../audio/engine'
import { STATIONS } from './layout'
import { effectiveDpr, sampleAtmosphere } from './dayNight'
import { PostFxEffects } from './PostFxEffects'
import { Lighting } from './Lighting'
import { SceneModelProvider } from './SceneModel'
import { Room } from './Room'
import { CameraRig } from './CameraRig'
import { Player } from './Player/Player'
import { Shelf } from './Shelf/Shelf'
import { RecordTransit } from './RecordTransit'
import { Volumetrics } from './Volumetrics'

const TARGET_FPS = 45

/** Cap WebGL to TARGET_FPS via demand frameloop — cuts GPU load ~50% vs 60fps always. */
function FpsLimiter() {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    let raf = 0
    let last = 0
    const interval = 1000 / TARGET_FPS
    const loop = (now: number) => {
      if (now - last >= interval) {
        last = now
        invalidate()
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [invalidate])
  return null
}

function EngineUpdater() {
  useFrame((_, dt) => engine.update(Math.min(dt, 0.1)))
  return null
}

/**
 * Swaps the shadow filter at runtime. Soft = VSM with a blur radius, which
 * reads like an area light (drei's PCSS shader is incompatible with three
 * r184, so VSM is the soft-shadow path).
 */
function ShadowQuality() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const soft = useSettings((s) => s.softShadows)
  useEffect(() => {
    gl.shadowMap.type = soft ? THREE.VSMShadowMap : THREE.PCFShadowMap
    gl.shadowMap.needsUpdate = true
    scene.traverse((o) => {
      const light = o as THREE.SpotLight
      if (light.isLight && light.shadow) {
        light.shadow.bias = soft ? -0.00008 : -0.0002
        light.shadow.normalBias = soft ? 0.01 : 0.02
        light.shadow.radius = soft ? 6 : 1
        light.shadow.blurSamples = 12
        light.shadow.needsUpdate = true
      }
      const mesh = o as THREE.Mesh
      if (!mesh.material) return
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const m of mats) m.needsUpdate = true
    })
  }, [gl, scene, soft])
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
  const ao = useSettings((s) => s.ambientOcclusion)
  return (
    <EffectComposer multisampling={0}>
      <PostFxEffects ao={ao} />
    </EffectComposer>
  )
}

export function Experience({ active }: { active: boolean }) {
  const dayPhase = useStore((s) => s.dayPhase)
  const view = useStore((s) => s.view)
  const resolutionMode = useSettings((s) => s.resolutionMode)
  const clarityView = view === 'shelf' || view === 'art'
  const dpr = effectiveDpr(dayPhase, resolutionMode, clarityView)
  return (
    <Canvas
      frameloop={active ? 'demand' : 'never'}
      dpr={dpr}
      camera={{ fov: 40, position: STATIONS.overview.pos.toArray(), near: 0.05, far: 30 }}
      onCreated={({ gl }) => {
        gl.shadowMap.enabled = true
        gl.shadowMap.type = THREE.PCFShadowMap
      }}
      onPointerMissed={() => requestUnfocus()}
    >
      {active && <FpsLimiter />}
      <ShadowQuality />
      <SceneBackground />
      <Lighting />
      <Suspense fallback={null}>
        <SceneModelProvider>
          <Room />
          <Player />
          <Shelf />
        </SceneModelProvider>
      </Suspense>
      <RecordTransit />
      <Volumetrics />
      <CameraRig />
      <EngineUpdater />
      <AtmospherePost />
    </Canvas>
  )
}
