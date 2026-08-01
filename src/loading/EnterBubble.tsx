export type BubbleState = 'hidden' | 'typing' | 'ready'

interface Props {
  state: BubbleState
  label: string
  onEnter: () => void
}

/**
 * iMessage-style outgoing bubble, bottom right. Both bubbles are always mounted
 * and anchored to the same bottom-right corner so the tail stays put while their
 * differing widths swap underneath it, and so the exit animation can play out
 * instead of being unmounted mid-transition.
 */
export function EnterBubble({ state, label, onEnter }: Props) {
  return (
    <div className={`bubbles bubbles--${state}`}>
      <div className="bubble bubble--typing" aria-hidden={state !== 'typing'}>
        <span className="bubble__dot" />
        <span className="bubble__dot" />
        <span className="bubble__dot" />
      </div>
      <button
        type="button"
        className="bubble bubble--enter"
        onClick={onEnter}
        disabled={state !== 'ready'}
        aria-hidden={state !== 'ready'}
      >
        {label}
      </button>
    </div>
  )
}
