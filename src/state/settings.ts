import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ShaftMode = 'off' | 'subtle' | 'pronounced'
export type ResolutionMode = 'auto' | 'standard' | 'high'

export interface GraphicsSettings {
  /** PCSS contact-hardening shadows (vs plain PCF) */
  softShadows: boolean
  /** N8AO screen-space ambient occlusion */
  ambientOcclusion: boolean
  /** window light shafts + dust motes */
  lightShafts: ShaftMode
  /** auto = 1× haze at golden hour/sunset, device DPR at night */
  resolutionMode: ResolutionMode

  setSoftShadows: (v: boolean) => void
  setAmbientOcclusion: (v: boolean) => void
  setLightShafts: (v: ShaftMode) => void
  setResolutionMode: (v: ResolutionMode) => void
}

type PersistedV0 = {
  softShadows?: boolean
  ambientOcclusion?: boolean
  lightShafts?: ShaftMode
  highRes?: boolean
  resolutionMode?: ResolutionMode
}

export const useSettings = create<GraphicsSettings>()(
  persist(
    (set) => ({
      softShadows: true,
      ambientOcclusion: true,
      lightShafts: 'pronounced',
      resolutionMode: 'auto',

      setSoftShadows: (softShadows) => set({ softShadows }),
      setAmbientOcclusion: (ambientOcclusion) => set({ ambientOcclusion }),
      setLightShafts: (lightShafts) => set({ lightShafts }),
      setResolutionMode: (resolutionMode) => set({ resolutionMode }),
    }),
    {
      name: 'record-room-graphics',
      version: 1,
      migrate: (persisted) => {
        const s = persisted as PersistedV0
        if (s.resolutionMode) return persisted as GraphicsSettings
        return {
          ...s,
          resolutionMode: s.highRes === false ? 'standard' : 'auto',
        } as GraphicsSettings
      },
      partialize: (s) => ({
        softShadows: s.softShadows,
        ambientOcclusion: s.ambientOcclusion,
        lightShafts: s.lightShafts,
        resolutionMode: s.resolutionMode,
      }),
    },
  ),
)

if (import.meta.env.DEV) {
  ;(window as unknown as { __settings: typeof useSettings }).__settings = useSettings
}
