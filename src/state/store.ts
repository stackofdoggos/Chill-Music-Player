import { create } from 'zustand'
import type { Album } from '../albums'

export type View = 'overview' | 'player' | 'shelf'
export type RecordPhase = 'none' | 'pullingOut' | 'out' | 'toPlatter' | 'onPlatter' | 'returning'
export type NeedleState = 'rest' | 'down'

export const PHASE_DURATION: Record<string, number> = {
  pullingOut: 0.55,
  toPlatter: 1.9,
  returning: 1.6,
}

interface State {
  albums: Album[]
  view: View
  selectedAlbumId: string | null
  recordPhase: RecordPhase
  phaseStart: number
  power: boolean
  volume: number
  speed: 33 | 45
  needle: NeedleState
  draggingTonearm: boolean
  nowPlayingTrack: number
  hint: string | null
  lidOpen: boolean

  setAlbums: (albums: Album[]) => void
  setView: (v: View) => void
  selectAlbum: (id: string) => void
  placeRecord: () => void
  returnRecord: () => void
  setPower: (on: boolean) => void
  setVolume: (v: number) => void
  setSpeed: (s: 33 | 45) => void
  setNeedle: (n: NeedleState) => void
  setDraggingTonearm: (d: boolean) => void
  setNowPlayingTrack: (i: number) => void
  setHint: (h: string | null) => void
  setLid: (open: boolean) => void
}

let phaseTimer: ReturnType<typeof setTimeout> | undefined

function schedulePhase(set: (s: Partial<State>) => void, next: RecordPhase, delayS: number) {
  clearTimeout(phaseTimer)
  phaseTimer = setTimeout(() => set({ recordPhase: next, phaseStart: performance.now() }), delayS * 1000)
}

export const useStore = create<State>((set, get) => ({
  albums: [],
  view: 'overview',
  selectedAlbumId: null,
  recordPhase: 'none',
  phaseStart: 0,
  power: false,
  volume: 0.7,
  speed: 33,
  needle: 'rest',
  draggingTonearm: false,
  nowPlayingTrack: -1,
  hint: null,
  lidOpen: false,

  setAlbums: (albums) => set({ albums }),
  setView: (view) => set({ view }),

  selectAlbum: (id) => {
    const { recordPhase, selectedAlbumId } = get()
    if (recordPhase === 'toPlatter' || recordPhase === 'onPlatter' || recordPhase === 'returning') {
      set({ hint: 'Return the record on the platter first' })
      return
    }
    if (selectedAlbumId === id && recordPhase === 'out') return
    set({ selectedAlbumId: id, recordPhase: 'pullingOut', phaseStart: performance.now(), hint: null })
    schedulePhase(set, 'out', PHASE_DURATION.pullingOut)
  },

  placeRecord: () => {
    if (get().recordPhase !== 'out') return
    set({ recordPhase: 'toPlatter', phaseStart: performance.now(), view: 'player' })
    schedulePhase(set, 'onPlatter', PHASE_DURATION.toPlatter)
  },

  returnRecord: () => {
    const { recordPhase, needle } = get()
    if (recordPhase !== 'onPlatter' || needle !== 'rest') return
    set({ recordPhase: 'returning', phaseStart: performance.now(), view: 'shelf', nowPlayingTrack: -1 })
    clearTimeout(phaseTimer)
    phaseTimer = setTimeout(
      () => set({ recordPhase: 'none', selectedAlbumId: null, phaseStart: performance.now() }),
      PHASE_DURATION.returning * 1000,
    )
  },

  setPower: (power) => set({ power }),
  setVolume: (volume) => set({ volume }),
  setSpeed: (speed) => set({ speed }),
  setNeedle: (needle) => set({ needle }),
  setDraggingTonearm: (draggingTonearm) => set({ draggingTonearm }),
  setNowPlayingTrack: (nowPlayingTrack) => set({ nowPlayingTrack }),
  setHint: (hint) => set({ hint }),
  setLid: (lidOpen) => set({ lidOpen }),
}))

export function selectedAlbum(s: State): Album | null {
  return s.albums.find((a) => a.id === s.selectedAlbumId) ?? null
}

if (import.meta.env.DEV) {
  ;(window as unknown as { __store: typeof useStore }).__store = useStore
}
