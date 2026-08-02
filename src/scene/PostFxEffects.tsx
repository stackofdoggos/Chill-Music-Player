import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  Bloom,
  BrightnessContrast,
  HueSaturation,
  N8AO,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing'
import {
  BlendFunction,
  ChromaticAberrationEffect,
  NoiseEffect,
  ToneMappingMode,
} from 'postprocessing'
import { Vector2 } from 'three'
import { sampleAtmosphere } from './dayNight'
import { SoftnessEffect } from './effects/SoftnessEffect'
import { TemporalBlendEffect } from './effects/TemporalBlendEffect'
import { POST_FX_DEFAULTS, usePostFx } from '../state/postFx'
import { useSettings } from '../state/settings'
import { useStore } from '../state/store'

/** Final grade, applied after tone mapping. */
const GRADE = { contrast: 0.2, brightness: -0.03, saturation: 0.12 }

export function PostFxEffects({ ao }: { ao: boolean }) {
  const dayPhase = useStore((s) => s.dayPhase)
  const view = useStore((s) => s.view)
  const resolutionMode = useSettings((s) => s.resolutionMode)
  const a = sampleAtmosphere(dayPhase)
  const clarityView = view === 'shelf' || view === 'art' || view === 'overview'

  const softnessEffect = useMemo(() => new SoftnessEffect(), [])
  const temporalEffect = useMemo(() => new TemporalBlendEffect(), [])
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
    const clarity = clarityView ? 0.38 : 1
    softnessEffect.radius = s.softnessRadius
    softnessEffect.blendMode.setOpacity(s.softness * autoBlurScale * clarity)
    temporalEffect.blend = s.temporalBlend * (clarityView ? 0.45 : 1)
    grainEffect.blendMode.setOpacity(s.grain)
    chromaticEffect.offset.set(s.chromaticX, s.chromaticY)
    if (chromaticEffect.radialModulation !== s.chromaticRadial) {
      chromaticEffect.radialModulation = s.chromaticRadial
    }
    chromaticEffect.modulationOffset = s.chromaticModulation
  })

  return (
    <>
      {ao && (
        <N8AO
          aoRadius={0.28}
          intensity={clarityView ? 3.1 : 2.6}
          distanceFalloff={0.6}
          halfRes
        />
      )}
      <Bloom intensity={a.bloomIntensity} luminanceThreshold={a.bloomThreshold} mipmapBlur />
      {/*
        EffectComposer forces the renderer to NoToneMapping and expects tone
        mapping as a pass. Without one everything above 1.0 hard-clipped, which
        is why warm phases lost all highlight detail.

        AGX because that is what the reference renders use: `layout.blend` is set
        to "AgX - Medium High Contrast" at +0.35 exposure. AgX desaturates as it
        clips, which is what keeps a blown window warm instead of white. The
        contrast half of that look is not part of the transform, so GRADE below
        stands in for it.
      */}
      <ToneMapping mode={ToneMappingMode.AGX} />
      {/*
        Grade after the tone curve. Without this the room sits in a narrow band
        of pale midtones — the reference's depth comes from letting shadows fall
        away, not from lighting everything evenly.
      */}
      <HueSaturation saturation={GRADE.saturation} />
      <BrightnessContrast contrast={GRADE.contrast} brightness={GRADE.brightness} />
      <primitive object={softnessEffect} />
      <primitive object={chromaticEffect} />
      <primitive object={temporalEffect} />
      <primitive object={grainEffect} />
      <Vignette eskil={false} offset={a.vignetteOffset} darkness={a.vignetteDarkness} />
    </>
  )
}
