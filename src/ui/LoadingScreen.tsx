interface Props {
  progress: number // 0..1
  status: string
  ready: boolean
  entered: boolean
  onEnter: () => void
  onDissolved?: () => void
}

export function LoadingScreen({ progress, status, ready, entered, onEnter, onDissolved }: Props) {
  return (
    <div
      className={`loading${entered ? ' loading--hidden' : ''}`}
      onTransitionEnd={(e) => {
        if (entered && e.propertyName === 'opacity') onDissolved?.()
      }}
    >
      <div className="loading__inner">
        <h1 className="loading__title">A Record Room</h1>
        <p className="loading__sub">
          Less, but better — pull an album from the shelf, set the needle, listen.
        </p>
        <div className="loading__bar">
          <div className="loading__fill" style={{ transform: `scaleX(${progress})` }} />
        </div>
        <p className="loading__status" aria-live="polite">
          {ready ? 'Ready' : status}
        </p>
        <button className="loading__enter" disabled={!ready} onClick={onEnter}>
          {ready ? 'Enter — sound on' : 'Please wait'}
        </button>
      </div>
      <div className="loading__footer">Headphones recommended</div>
    </div>
  )
}
