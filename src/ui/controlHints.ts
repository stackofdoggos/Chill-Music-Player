import type { State } from '../state/store'

export type ControlHint = { key: string; label: string }

export type ControlHintState = Pick<
  State,
  'view' | 'shelfPhase' | 'hoveredAlbumId' | 'selectedAlbumId'
>

export function buildControlHints(s: ControlHintState): ControlHint[] {
  const hints: ControlHint[] = []

  if (s.view === 'volume') {
    hints.push({ key: '↑', label: 'Louder' })
    hints.push({ key: '↓', label: 'Quieter' })
    hints.push({ key: 'Esc', label: 'Back' })
    return hints
  }

  if (s.view === 'arm') {
    hints.push({ key: 'Esc', label: 'Back' })
    return hints
  }

  if (s.view === 'shelf') {
    const inspecting = s.shelfPhase === 'out' || s.shelfPhase === 'pullingOut'
    if (inspecting) {
      hints.push({ key: 'F', label: 'Flip cover' })
      if (s.hoveredAlbumId && s.hoveredAlbumId !== s.selectedAlbumId) {
        hints.push({ key: 'P', label: 'Swap record' })
      } else {
        hints.push({ key: 'P', label: 'Return to shelf' })
      }
    } else if (s.hoveredAlbumId) {
      hints.push({ key: 'P', label: 'Take out' })
    }
    hints.push({ key: 'Esc', label: 'Back' })
    return hints
  }

  if (s.view === 'player') {
    hints.push({ key: 'Esc', label: 'Back' })
    return hints
  }

  if (s.view === 'art') {
    hints.push({ key: 'Esc', label: 'Back' })
    return hints
  }

  return hints
}
