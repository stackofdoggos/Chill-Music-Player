interface Props {
  progress: number // 0..1
  ready: boolean
  entered: boolean
  onEnter: () => void
}

export function LoadingScreen({ progress, ready, entered, onEnter }: Props) {
  return (
    <div className={`loading${entered ? ' loading--hidden' : ''}`}>
      <div className="loading__inner">
        <h1 className="loading__title">A Record Room</h1>
        <p className="loading__sub">
          Less, but better — pull an album from the shelf, set the needle, listen.
        </p>
        <div className="loading__bar">
          <div className="loading__fill" style={{ transform: `scaleX(${ready ? 1 : progress})` }} />
        </div>
        <button className="loading__enter" disabled={!ready} onClick={onEnter}>
          {ready ? 'Enter — sound on' : 'Loading…'}
        </button>
      </div>
      <div className="loading__footer">Headphones recommended</div>
    </div>
  )
}
