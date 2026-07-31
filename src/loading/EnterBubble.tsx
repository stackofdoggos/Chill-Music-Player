interface Props {
  ready: boolean
  onEnter: () => void
}

/** Yandhi-style iMessage bubble — bottom-right; typing dots until ready. */
export function EnterBubble({ ready, onEnter }: Props) {
  return (
    <div className={`enter-bubble${ready ? ' enter-bubble--ready' : ''}`}>
      {!ready ? (
        <div className="enter-bubble__typing" aria-live="polite" aria-label="Loading">
          <span />
          <span />
          <span />
        </div>
      ) : (
        <button type="button" className="enter-bubble__btn" onClick={onEnter}>
          Enter — sound on
        </button>
      )}
    </div>
  )
}
