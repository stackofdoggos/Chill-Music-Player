import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Bloom, N8AO, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ChromaticAberrationEffect, NoiseEffect } from 'postprocessing'
import { Vector2 } from 'three'
import { sampleAtmosphere } from './dayNight'
import { SoftnessEffect } from './effects/SoftnessEffect'
import { TemporalBlendEffect } from './effects/TemporalBlendEffect'
import { POST_FX_DEFAULTS, usePostFx } from '../state/postFx'
import { useSettings } from '../state/settings'
import { useStore } from '../state/store'

export function PostFxEffects({ ao }: { ao: boolean }) {
  const dayPhase = useStore((s) => s.dayPhase)
  const resolutionMode = useSettings((s) => s.resolutionMode)
  const a = sampleAtmosphere(dayPhase)

  const softnessEffect = useMemo(() => new SoftnessEffect(), [])
  const temporalEffect = useMemo(() => new TemporalBlendEffect(), [])
  const useTemporal = POST_FX_DEFAULTS.temporalBlend > 0.01
  const grainEffect = useMemo(
    () => new NoiseEffect({ blendFunction: BlendFunction.SCREEN, premultiply: true }),
    [],
  )
  const chromaticEffect = useMemo(
    () =>
      new ChromaticAberrationEffect({
        offset: new Vector2(POST_FX_DEFAULTS.chromaticX, POST_FX_DEFAULTS.chromaticY),
        radialModulation: POST_FX_DEFAULTS.chromaticRadial,
        modulationOffset: POST_FX_DEFAULTS.chromaticModulation,
      }),
    [],
  )

  useFrame(() => {
    const s = usePostFx.getState()
    const autoBlurScale = resolutionMode === 'auto' ? 1 / 3 : 1
    softnessEffect.radius = s.softnessRadius
    softnessEffect.blendMode.setOpacity(s.softness * autoBlurScale)
    if (useTemporal) temporalEffect.blend = s.temporalBlend
    grainEffect.blendMode.setOpacity(s.grain)
    chromaticEffect.offset.set(s.chromaticX, s.chromaticY)
    if (chromaticEffect.radialModulation !== s.chromaticRadial) {
      chromaticEffect.radialModulation = s.chromaticRadial
    }
    chromaticEffect.modulationOffset = s.chromaticModulation
  })

  return (
    <>
      {ao && <N8AO aoRadius={0.28} intensity={2.6} distanceFalloff={0.6} halfRes />}
      <Bloom intensity={a.bloomIntensity} luminanceThreshold={a.bloomThreshold} mipmapBlur />
      <primitive object={softnessEffect} />
      <primitive object={chromaticEffect} />
      {useTemporal && <primitive object={temporalEffect} />}
      <primitive object={grainEffect} />
      <Vignette eskil={false} offset={a.vignetteOffset} darkness={a.vignetteDarkness} />
    </>
  )
}
