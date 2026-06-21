import { create } from 'zustand'
import type { Album } from '../albums'

export type View = 'overview' | 'player' | 'shelf' | 'volume' | 'arm' | 'art'
export type ShelfPhase = 'none' | 'pullingOut' | 'out'
export type RecordPhase = 'none' | 'toPlatter' | 'onPlatter' | 'returning'
export type NeedleState = 'rest' | 'down'

export const PHASE_DURATION: Record<string, number> = {
  pullingOut: 0.55,
  toPlatter: 1.9,
  returning: 1.6,
}

export interface State {
  albums: Album[]
  view: View
  selectedAlbumId: string | null
  platterAlbumId: string | null
  shelfPhase: ShelfPhase
  recordPhase: RecordPhase
  phaseStart: number
  power: boolean
  volume: number
  speed: 33 | 45
  needle: NeedleState
  draggingTonearm: boolean
  draggingSleeve: boolean
  sleeveSide: 'front' | 'back'
  nowPlayingTrack: number
  hint: string | null
  lidOpen: boolean
  hoveredAlbumId: string | null
  /** 0–1 day-night cycle for natural window lighting (dev slider) */
  dayPhase: number

  setAlbums: (albums: Album[]) => void
  setView: (v: View) => void
  selectAlbum: (id: string) => void
  putBackSleeve: () => boolean
  clickShelfBackdrop: () => 'putBack' | 'focus' | null
  pressP: () => 'putBack' | 'select' | 'swap' | null
  setHoveredAlbumId: (id: string | null) => void
  placeRecord: () => void
  returnRecord: () => void
  setPower: (on: boolean) => void
  setVolume: (v: number) => void
  setSpeed: (s: 33 | 45) => void
  setNeedle: (n: NeedleState) => void
  setDraggingTonearm: (d: boolean) => void
  setDraggingSleeve: (d: boolean) => void
  setSleeveSide: (side: 'front' | 'back') => void
  flipSleeve: () => void
  setNowPlayingTrack: (i: number) => void
  setHint: (h: string | null) => void
  setLid: (open: boolean) => void
  setDayPhase: (phase: number) => void
}

let phaseTimer: ReturnType<typeof setTimeout> | undefined
let shelfPhaseTimer: ReturnType<typeof setTimeout> | undefined

function schedulePhase(set: (s: Partial<State>) => void, next: RecordPhase, delayS: number) {
  clearTimeout(phaseTimer)
  phaseTimer = setTimeout(() => set({ recordPhase: next, phaseStart: performance.now() }), delayS * 1000)
}

function scheduleShelfPhase(set: (s: Partial<State>) => void, next: ShelfPhase, delayS: number) {
  clearTimeout(shelfPhaseTimer)
  shelfPhaseTimer = setTimeout(() => set({ shelfPhase: next, phaseStart: performance.now() }), delayS * 1000)
}

function inspectingSleeve(s: State) {
  return !!s.selectedAlbumId && (s.shelfPhase === 'out' || s.shelfPhase === 'pullingOut')
}

export const useStore = create<State>((set, get) => ({
  albums: [],
  view: 'overview',
  selectedAlbumId: null,
  platterAlbumId: null,
  shelfPhase: 'none',
  recordPhase: 'none',
  phaseStart: 0,
  power: false,
  volume: 0.7,
  speed: 33,
  needle: 'rest',
  draggingTonearm: false,
  draggingSleeve: false,
  sleeveSide: 'front',
  nowPlayingTrack: -1,
  hint: null,
  lidOpen: false,
  hoveredAlbumId: null,
  dayPhase: 0.65,

  setAlbums: (albums) => set({ albums }),
  setView: (view) => set({ view, hoveredAlbumId: view === 'shelf' ? get().hoveredAlbumId : null }),

  selectAlbum: (id) => {
    const { recordPhase, selectedAlbumId, shelfPhase } = get()
    if (recordPhase === 'toPlatter' || recordPhase === 'returning') {
      set({ hint: 'Return the record on the platter first' })
      return
    }
    if (selectedAlbumId === id && shelfPhase === 'out') return
    set({ selectedAlbumId: id, shelfPhase: 'pullingOut', phaseStart: performance.now(), hint: null, sleeveSide: 'front' })
    scheduleShelfPhase(set, 'out', PHASE_DURATION.pullingOut)
  },

  putBackSleeve: () => {
    const { recordPhase, shelfPhase, selectedAlbumId } = get()
    if (recordPhase === 'toPlatter' || recordPhase === 'returning') {
      set({ hint: 'Return the record on the platter first' })
      return false
    }
    if (!selectedAlbumId || (shelfPhase !== 'out' && shelfPhase !== 'pullingOut')) return false
    clearTimeout(shelfPhaseTimer)
    set({ shelfPhase: 'none', selectedAlbumId: null, sleeveSide: 'front', phaseStart: performance.now(), hint: null })
    return true
  },

  clickShelfBackdrop: () => {
    if (dragActiveOrRecent()) return null
    const s = get()
    if (inspectingSleeve(s)) return get().putBackSleeve() ? 'putBack' : null
    if (s.view !== 'shelf') {
      set({ view: 'shelf' })
      return 'focus'
    }
    return null
  },

  pressP: () => {
    const s = get()
    if (s.view !== 'shelf') return null
    if (s.recordPhase === 'toPlatter' || s.recordPhase === 'returning') {
      set({ hint: 'Return the record on the platter first' })
      return null
    }

    const inspecting = inspectingSleeve(s)
    const hovered = s.hoveredAlbumId

    if (inspecting) {
      if (hovered && hovered !== s.selectedAlbumId) {
        get().selectAlbum(hovered)
        return 'swap'
      }
      return get().putBackSleeve() ? 'putBack' : null
    }

    if (!hovered) return null
    get().selectAlbum(hovered)
    return 'select'
  },

  setHoveredAlbumId: (hoveredAlbumId) => set({ hoveredAlbumId }),

  placeRecord: () => {
    const { shelfPhase, recordPhase, selectedAlbumId } = get()
    if (shelfPhase !== 'out') return
    if (recordPhase === 'onPlatter' || recordPhase === 'toPlatter' || recordPhase === 'returning') {
      set({ hint: 'Return the record on the platter first' })
      return
    }
    clearTimeout(shelfPhaseTimer)
    set({
      recordPhase: 'toPlatter',
      platterAlbumId: selectedAlbumId,
      phaseStart: performance.now(),
      view: 'player',
      sleeveSide: 'front',
      shelfPhase: 'none',
    })
    schedulePhase(set, 'onPlatter', PHASE_DURATION.toPlatter)
  },

  returnRecord: () => {
    const { recordPhase, needle } = get()
    if (recordPhase !== 'onPlatter' || needle !== 'rest') return
    set({ recordPhase: 'returning', phaseStart: performance.now(), view: 'shelf', nowPlayingTrack: -1 })
    clearTimeout(phaseTimer)
    phaseTimer = setTimeout(
      () => set({ recordPhase: 'none', platterAlbumId: null, phaseStart: performance.now() }),
      PHASE_DURATION.returning * 1000,
    )
  },

  setPower: (power) => set({ power }),
  setVolume: (volume) => set({ volume }),
  setSpeed: (speed) => set({ speed }),
  setNeedle: (needle) => set({ needle }),
  setDraggingTonearm: (draggingTonearm) => set({ draggingTonearm }),
  setDraggingSleeve: (draggingSleeve) => set({ draggingSleeve }),
  setSleeveSide: (sleeveSide) => set({ sleeveSide }),
  flipSleeve: () => {
    const { view, shelfPhase, sleeveSide, draggingSleeve } = get()
    if (view !== 'shelf' || shelfPhase !== 'out' || draggingSleeve) return
    set({ sleeveSide: sleeveSide === 'front' ? 'back' : 'front' })
  },
  setNowPlayingTrack: (nowPlayingTrack) => set({ nowPlayingTrack }),
  setHint: (hint) => set({ hint }),
  setLid: (lidOpen) => set({ lidOpen }),
  setDayPhase: (dayPhase) => set({ dayPhase: Math.min(1, Math.max(0, dayPhase)) }),
}))

export function selectedAlbum(s: State): Album | null {
  return s.albums.find((a) => a.id === s.selectedAlbumId) ?? null
}

export function platterAlbum(s: State): Album | null {
  return s.albums.find((a) => a.id === s.platterAlbumId) ?? null
}

/** where clicking off / Esc leads from each view */
const BACK: Record<View, View> = {
  overview: 'overview',
  shelf: 'overview',
  player: 'overview',
  volume: 'player',
  arm: 'player',
  art: 'overview',
}

let lastDragEnd = 0

/** call when a knob/tonearm/sleeve drag releases so the trailing click can't unfocus */
export function markDragEnd() {
  lastDragEnd = performance.now()
}

/**
 * True while a knob/tonearm/sleeve drag is active or ended <350ms ago. The browser
 * fires a click after every drag release; guard any click handler that should
 * not react to that trailing click (unfocus, power, lid, record return, ...).
 */
export function dragActiveOrRecent() {
  const s = useStore.getState()
  return s.draggingTonearm || s.draggingSleeve || performance.now() - lastDragEnd < 350
}

/**
 * Step back one view level (click on walls/floor, pointer-miss, Esc).
 * Ignored after drags, so a drag that finishes off the player/sleeve never unfocuses it.
 */
export function requestUnfocus() {
  if (dragActiveOrRecent()) return
  const s = useStore.getState()
  s.setView(BACK[s.view])
}

if (import.meta.env.DEV) {
  ;(window as unknown as { __store: typeof useStore }).__store = useStore
}
