import { useEffect, useMemo } from 'react'
import { useStore, platterAlbum } from '../state/store'
import { buildControlHints } from './controlHints'

function KeyHint({ hint }: { hint: { key: string; label: string } }) {
  return (
    <div className="controls__row">
      <kbd className="controls__key">{hint.key}</kbd>
      <span className="controls__label">{hint.label}</span>
    </div>
  )
}

export function NowPlaying() {
  const album = useStore(platterAlbum)
  const trackIndex = useStore((s) => s.nowPlayingTrack)
  const hint = useStore((s) => s.hint)
  const setHint = useStore((s) => s.setHint)
  const view = useStore((s) => s.view)
  const shelfPhase = useStore((s) => s.shelfPhase)
  const hoveredAlbumId = useStore((s) => s.hoveredAlbumId)
  const selectedAlbumId = useStore((s) => s.selectedAlbumId)

  useEffect(() => {
    if (!hint) return
    const t = setTimeout(() => setHint(null), 3000)
    return () => clearTimeout(t)
  }, [hint, setHint])

  const track = album && trackIndex >= 0 ? album.tracks[trackIndex] : null
  const controls = useMemo(
    () =>
      buildControlHints({
        view,
        shelfPhase,
        hoveredAlbumId,
        selectedAlbumId,
      }),
    [view, shelfPhase, hoveredAlbumId, selectedAlbumId],
  )

  return (
    <>
      <div className={`hint${hint ? ' hint--visible' : ''}`}>{hint}</div>
      <div className="hud">
        {track && (
          <div className="nowplaying nowplaying--visible">
            <div className="nowplaying__track">{track.name}</div>
            <div className="nowplaying__album">
              {album!.artist} — {album!.title}
            </div>
          </div>
        )}
        {controls.length > 0 && (
          <div className="controls">
            {controls.map((row, i) => (
              <KeyHint key={i} hint={row} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
