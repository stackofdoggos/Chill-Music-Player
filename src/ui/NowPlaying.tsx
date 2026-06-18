import { useEffect } from 'react'
import { useStore, selectedAlbum } from '../state/store'

export function NowPlaying() {
  const album = useStore(selectedAlbum)
  const trackIndex = useStore((s) => s.nowPlayingTrack)
  const hint = useStore((s) => s.hint)
  const setHint = useStore((s) => s.setHint)
  const view = useStore((s) => s.view)
  const shelfPhase = useStore((s) => s.shelfPhase)
  const phase = useStore((s) => s.recordPhase)

  useEffect(() => {
    if (!hint) return
    const t = setTimeout(() => setHint(null), 3000)
    return () => clearTimeout(t)
  }, [hint, setHint])

  const track = album && trackIndex >= 0 ? album.tracks[trackIndex] : null
  const power = useStore((s) => s.power)
  const needle = useStore((s) => s.needle)

  let help: string | null = null
  if (view === 'overview') help = 'Click the shelf to browse records'
  else if (view === 'shelf' && shelfPhase === 'none') help = 'Click a spine to pull a record out'
  else if (view === 'shelf' && shelfPhase === 'out') help = 'Drag the sleeve or press F to flip it — click again to put it on'
  else if (view === 'volume') help = 'Drag the knob or use the arrow keys — click away to go back'
  else if (view === 'arm') help = 'Drag the arm over the record and let go — click the base to go back'
  else if (view === 'player' && phase === 'onPlatter' && needle === 'down' && !power)
    help = 'Flick the power switch to spin the platter'
  else if (view === 'player' && phase === 'onPlatter' && !track)
    help = 'Switch the power on, then drag the tonearm onto the record'

  return (
    <>
      <div className={`hint${hint ? ' hint--visible' : ''}`}>{hint}</div>
      <div className={`help${help ? ' help--visible' : ''}`}>{help}</div>
      <div className={`nowplaying${track ? ' nowplaying--visible' : ''}`}>
        {track && (
          <>
            <div className="nowplaying__track">{track.name}</div>
            <div className="nowplaying__album">
              {album!.artist} — {album!.title}
            </div>
          </>
        )}
      </div>
    </>
  )
}
