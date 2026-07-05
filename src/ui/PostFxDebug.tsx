import { useRef } from 'react'
import { Leva, useControls, button } from 'leva'
import { POST_FX_DEFAULTS, usePostFx } from '../state/postFx'

export function PostFxDebug() {
  if (!import.meta.env.DEV) return null

  const setLeva = useRef<(v: typeof POST_FX_DEFAULTS) => void>(() => {})

  const [, set] = useControls(
    () => ({
      chromaticX: {
        value: POST_FX_DEFAULTS.chromaticX,
        min: 0,
        max: 0.004,
        step: 0.00005,
        label: 'CA X',
        onChange: (v: number) => usePostFx.setState({ chromaticX: v }),
      },
      chromaticY: {
        value: POST_FX_DEFAULTS.chromaticY,
        min: 0,
        max: 0.004,
        step: 0.00005,
        label: 'CA Y',
        onChange: (v: number) => usePostFx.setState({ chromaticY: v }),
      },
      chromaticRadial: {
        value: POST_FX_DEFAULTS.chromaticRadial,
        label: 'CA radial',
        onChange: (v: boolean) => usePostFx.setState({ chromaticRadial: v }),
      },
      chromaticModulation: {
        value: POST_FX_DEFAULTS.chromaticModulation,
        min: 0,
        max: 1,
        step: 0.01,
        label: 'CA edge',
        onChange: (v: number) => usePostFx.setState({ chromaticModulation: v }),
      },
      grain: {
        value: POST_FX_DEFAULTS.grain,
        min: 0,
        max: 0.45,
        step: 0.01,
        onChange: (v: number) => usePostFx.setState({ grain: v }),
      },
      temporalBlend: {
        value: POST_FX_DEFAULTS.temporalBlend,
        min: 0,
        max: 0.5,
        step: 0.01,
        label: 'temporal',
        onChange: (v: number) => usePostFx.setState({ temporalBlend: v }),
      },
      softness: {
        value: POST_FX_DEFAULTS.softness,
        min: 0,
        max: 1,
        step: 0.01,
        label: 'lens soft',
        onChange: (v: number) => usePostFx.setState({ softness: v }),
      },
      softnessRadius: {
        value: POST_FX_DEFAULTS.softnessRadius,
        min: 0,
        max: 3,
        step: 0.05,
        label: 'soft radius',
        onChange: (v: number) => usePostFx.setState({ softnessRadius: v }),
      },
      'Log values': button(() => {
        console.log('Post FX values:', JSON.stringify(usePostFx.getState(), null, 2))
      }),
      Reset: button(() => {
        usePostFx.setState({ ...POST_FX_DEFAULTS })
        setLeva.current(POST_FX_DEFAULTS)
      }),
    }),
    { collapsed: false },
  )

  setLeva.current = set

  return <Leva titleBar={{ title: 'Post FX', filter: false }} />
}
