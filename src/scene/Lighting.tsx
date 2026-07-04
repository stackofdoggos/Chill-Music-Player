import { useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import type { DirectionalLight, HemisphereLight, Object3D, PointLight, RectAreaLight, SpotLight } from 'three'
import { RectAreaLightUniformsLib } from 'three-stdlib'
import { PLAYER_POS, ROOM } from './layout'
import { sampleAtmosphere } from './dayNight'
import { useStore } from '../state/store'

RectAreaLightUniformsLib.init()

/** Static reflection rig — intensity scaled via scene.environmentIntensity per phase. */
function SceneEnvironment() {
  return (
    <Environment resolution={256}>
      <Lightformer intensity={3} position={[3, 1.6, 0]} rotation-y={-Math.PI / 2} scale={[3, 2, 1]} color="#fff3df" />
      <Lightformer intensity={1.2} position={[0, 2.8, 0]} rotation-x={Math.PI / 2} scale={[4, 4, 1]} color="#ffffff" />
      <Lightformer intensity={0.8} position={[0, 1.2, 3]} scale={[4, 2, 1]} color="#e8e4da" />
      <Lightformer intensity={0.4} position={[-3, 1.2, 0]} rotation-y={Math.PI / 2} scale={[3, 2, 1]} color="#d8d4ca" />
    </Environment>
  )
}

export function Lighting() {
  const scene = useThree((s) => s.scene)
  const hemi = useRef<HemisphereLight>(null)
  const sun = useRef<SpotLight>(null)
  const sunTarget = useRef<Object3D>(null)
  const fill = useRef<DirectionalLight>(null)
  const fillTarget = useRef<Object3D>(null)
  const lamp = useRef<PointLight>(null)
  const windowLight = useRef<RectAreaLight>(null)

  useLayoutEffect(() => {
    const bound: Object3D[] = []
    const light = sun.current
    const target = sunTarget.current
    if (light && target) {
      light.target = target
      scene.add(target)
      bound.push(target)
    }
    const fillLight = fill.current
    const fillT = fillTarget.current
    if (fillLight && fillT) {
      fillLight.target = fillT
      scene.add(fillT)
      bound.push(fillT)
    }
    return () => bound.forEach((o) => scene.remove(o))
  }, [scene])

  useFrame(() => {
    const a = sampleAtmosphere(useStore.getState().dayPhase)
    scene.environmentIntensity = a.environmentIntensity

    if (hemi.current) {
      hemi.current.color.copy(a.hemiSky)
      hemi.current.groundColor.copy(a.hemiGround)
      hemi.current.intensity = a.hemiIntensity
    }
    if (sun.current && sunTarget.current) {
      sun.current.position.copy(a.keyPos)
      sunTarget.current.position.copy(a.keyTarget)
      sun.current.color.copy(a.keyColor)
      sun.current.intensity = a.keyIntensity
      sun.current.angle = a.sunAngle
    }
    if (fill.current && fillTarget.current) {
      fill.current.color.copy(a.fillColor)
      fill.current.intensity = a.fillIntensity
      fill.current.position.copy(a.fillPos)
      fillTarget.current.position.set(0, 0, 0)
    }
    if (lamp.current) {
      lamp.current.color.copy(a.lampColor)
      lamp.current.intensity = a.lampIntensity
    }
    if (windowLight.current) {
      // soft area glow from the window pane — gives walls/floor the gentle
      // wraparound falloff a real window produces. Kept well below the sun
      // spotlight: rect lights cast no shadows, so if this dominates it
      // washes the sun shadows out (shelf/desk shadows vanish).
      windowLight.current.color.copy(a.windowEmissive)
      windowLight.current.intensity = a.windowEmissiveIntensity * 0.12 + a.hemiIntensity * 0.5
    }
  }, -1)

  return (
    <>
      <object3D ref={sunTarget} />
      <object3D ref={fillTarget} />
      <hemisphereLight ref={hemi} />
      {/* window sun — spotlight sweeps as position moves along the day arc */}
      <spotLight
        ref={sun}
        castShadow
        distance={14}
        decay={1}
        penumbra={0.45}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
        shadow-camera-near={0.4}
        shadow-camera-far={16}
      />
      <directionalLight ref={fill} position={[-2, 1.8, 2.2]} />
      {/* window pane as a real area light (LTC), matching the emissive plane in Room */}
      <rectAreaLight
        ref={windowLight}
        position={[ROOM.w / 2 - 0.03, 1.45, -0.55]}
        rotation-y={Math.PI / 2}
        width={1.35}
        height={1.05}
      />
      <pointLight
        ref={lamp}
        position={[PLAYER_POS.x, PLAYER_POS.y + 0.55, PLAYER_POS.z]}
        distance={3.2}
        decay={2}
      />
      <SceneEnvironment />
    </>
  )
}
