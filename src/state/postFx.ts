import { create } from 'zustand'

export interface PostFxSettings {
  chromaticX: number
  chromaticY: number
  chromaticRadial: boolean
  chromaticModulation: number
  grain: number
  temporalBlend: number
  softness: number
  softnessRadius: number
}

export const POST_FX_DEFAULTS: PostFxSettings = {
  chromaticX: 0.00035,
  chromaticY: 0.0002,
  chromaticRadial: true,
  chromaticModulation: 0.18,
  grain: 0.35,
  temporalBlend: 0.02,
  softness: 0.22,
  softnessRadius: 0.75,
}

export const usePostFx = create<PostFxSettings>(() => ({ ...POST_FX_DEFAULTS }))

if (import.meta.env.DEV) {
  ;(window as unknown as { __postFx: typeof usePostFx }).__postFx = usePostFx
}
