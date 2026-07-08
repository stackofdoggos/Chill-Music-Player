import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ShaftMode = 'off' | 'subtle' | 'pronounced'
export type ResolutionMode = 'auto' | 'standard' | 'high'

export interface GraphicsSettings {
  /** PCSS contact-hardening shadows (vs plain PCF) */
  softShadows: boolean
  /** N8AO screen-space ambient occlusion */
  ambientOcclusion: boolean
  /** window light shafts */
  lightShafts: ShaftMode
  /** auto = 1× haze at golden hour/sunset, device DPR at night */
  resolutionMode: ResolutionMode
  /** quiet groove crackle while the needle is down */
  crackle: boolean

  setSoftShadows: (v: boolean) => void
  setAmbientOcclusion: (v: boolean) => void
  setLightShafts: (v: ShaftMode) => void
  setResolutionMode: (v: ResolutionMode) => void
  setCrackle: (v: boolean) => void
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
      resolutionMode: 'high',
      crackle: true,

      setSoftShadows: (softShadows) => set({ softShadows }),
      setAmbientOcclusion: (ambientOcclusion) => set({ ambientOcclusion }),
      setLightShafts: (lightShafts) => set({ lightShafts }),
      setResolutionMode: (resolutionMode) => set({ resolutionMode }),
      setCrackle: (crackle) => set({ crackle }),
    }),
    {
      name: 'record-room-graphics',
      version: 2,
      migrate: (persisted, version) => {
        const s = persisted as PersistedV0 & { crackle?: boolean }
        let state: PersistedV0 & { crackle?: boolean } = s
        if (!s.resolutionMode) {
          state = {
            ...s,
            resolutionMode: s.highRes === false ? 'standard' : 'auto',
          }
        }
        if (version < 2) state = { ...state, crackle: state.crackle ?? true }
        return state as GraphicsSettings
      },
      partialize: (s) => ({
        softShadows: s.softShadows,
        ambientOcclusion: s.ambientOcclusion,
        lightShafts: s.lightShafts,
        resolutionMode: s.resolutionMode,
        crackle: s.crackle,
      }),
    },
  ),
)

if (import.meta.env.DEV) {
  ;(window as unknown as { __settings: typeof useSettings }).__settings = useSettings
}
