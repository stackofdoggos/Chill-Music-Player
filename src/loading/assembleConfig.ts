export type AssembleVariant = 'player' | 'sleeve'

const STORAGE_KEY = 'chill.assembleVariant'

export function readAssembleVariant(): AssembleVariant {
  try {
    const q = new URLSearchParams(window.location.search).get('assemble')
    if (q === 'player' || q === 'sleeve') return q
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'player' || stored === 'sleeve') return stored
  } catch {
    /* ignore */
  }
  return 'player'
}

export function writeAssembleVariant(v: AssembleVariant) {
  try {
    localStorage.setItem(STORAGE_KEY, v)
  } catch {
    /* ignore */
  }
}

/** Shorter than the ~13s Yandhi clip. */
export const TIMING = {
  partIn: 0.42,
  partStagger: 0.14,
  settle: 0.35,
  spinHold: 2.4,
  loopGap: 0.55,
} as const

export const EXPLODED_PLAYER_PATH = 'models/exploded_player.glb'
