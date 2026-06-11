import { useEffect } from 'react'
import { useStore, selectedAlbum } from '../state/store'

export function NowPlaying() {
  const album = useStore(selectedAlbum)
  const trackIndex = useStore((s) => s.nowPlayingTrack)
  const hint = useStore((s) => s.hint)
  const setHint = useStore((s) => s.setHint)
  const view = useStore((s) => s.view)
  const phase = useStore((s) => s.recordPhase)

  useEffect(() => {
    if (!hint) return
    const t = setTimeout(() => setHint(null), 3000)
    return () => clearTimeout(t)
  }, [hint, setHint])

  const track = album && trackIndex >= 0 ? album.tracks[trackIndex] : null

  const help =
    view === 'overview'
      ? 'Click the shelf to browse records'
      : view === 'shelf' && phase === 'none'
        ? 'Click a spine to pull a record out'
        : view === 'shelf' && phase === 'out'
          ? 'Click the sleeve again to put it on'
          : view === 'player' && phase === 'onPlatter' && !track
            ? 'Switch the power on, then drag the tonearm onto the record'
            : null

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
