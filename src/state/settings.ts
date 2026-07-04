import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ShaftMode = 'off' | 'subtle' | 'pronounced'

export interface GraphicsSettings {
  /** PCSS contact-hardening shadows (vs plain PCF) */
  softShadows: boolean
  /** N8AO screen-space ambient occlusion */
  ambientOcclusion: boolean
  /** window light shafts + dust motes */
  lightShafts: ShaftMode
  /** render at device pixel ratio (High) or 1x (Standard) */
  highRes: boolean
  panelOpen: boolean

  setSoftShadows: (v: boolean) => void
  setAmbientOcclusion: (v: boolean) => void
  setLightShafts: (v: ShaftMode) => void
  setHighRes: (v: boolean) => void
  setPanelOpen: (v: boolean) => void
}

export const useSettings = create<GraphicsSettings>()(
  persist(
    (set) => ({
      softShadows: true,
      ambientOcclusion: true,
      lightShafts: 'subtle',
      highRes: true,
      panelOpen: false,

      setSoftShadows: (softShadows) => set({ softShadows }),
      setAmbientOcclusion: (ambientOcclusion) => set({ ambientOcclusion }),
      setLightShafts: (lightShafts) => set({ lightShafts }),
      setHighRes: (highRes) => set({ highRes }),
      setPanelOpen: (panelOpen) => set({ panelOpen }),
    }),
    {
      name: 'record-room-graphics',
      partialize: (s) => ({
        softShadows: s.softShadows,
        ambientOcclusion: s.ambientOcclusion,
        lightShafts: s.lightShafts,
        highRes: s.highRes,
      }),
    },
  ),
)

if (import.meta.env.DEV) {
  ;(window as unknown as { __settings: typeof useSettings }).__settings = useSettings
}
