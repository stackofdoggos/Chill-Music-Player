import { useEffect, useRef, useState } from 'react'
import { assetUrl } from '../assetUrl'

interface Props {
  onUnmute: () => void
}

/**
 * Centered gesture gate. Browsers block audible autoplay until the user has
 * interacted with the page, so this click is what lets the intro start with its
 * music already in sync — and it buys time for the clip to buffer.
 */
export function UnmuteGate({ onUnmute }: Props) {
  const [on, setOn] = useState(false)
  const click = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    // Preloaded as a plain element: engine.init() still has to fetch and decode
    // its samples, which is far too slow to answer a button press. WAV rather
    // than mp3 so there is no decoder padding in front of the transient.
    const el = new Audio(assetUrl('sfx/ui-click.wav'))
    el.preload = 'auto'
    el.volume = 0.5
    click.current = el
  }, [])

  const press = () => {
    if (on) return
    setOn(true)
    void click.current?.play().catch(() => {})
    setTimeout(onUnmute, 480) // let the icon finish landing before the gate clears
  }

  return (
    <div className={`unmute${on ? ' unmute--on' : ''}`}>
      <button
        type="button"
        className="unmute__btn"
        onClick={press}
        aria-label="Turn sound on and begin"
      >
        <span className="unmute__ring" />
        <span className="unmute__ring unmute__ring--2" />
        {/* Proportions measured off SF Symbols' own speaker.slash.fill: the
            slash's ink box is 1.10x the cone height with the cone inset 9.8%
            from its left, and the cut is 2.70x the slash's stroke width. */}
        <svg className="unmute__icon" viewBox="0 0 48 48" aria-hidden="true">
          <defs>
            {/* The gap has to be a real hole. Drawing a page-coloured copy of
                the slash underneath instead shows up as a pale stripe wherever
                it leaves the cone and crosses the button's gradient. */}
            <mask
              id="unmute-slash-cut"
              maskUnits="userSpaceOnUse"
              x="-8"
              y="-8"
              width="64"
              height="64"
            >
              <rect x="-8" y="-8" width="64" height="64" fill="#fff" />
              <line className="unmute__cut" x1="8.3" y1="10.6" x2="35.1" y2="37.4" />
            </mask>
          </defs>
          <g mask="url(#unmute-slash-cut)">
            <path className="unmute__cone" d="M9.9 17.4h9L28.9 10.7v26.6L18.9 30.6H9.9z" />
            <path className="unmute__wave unmute__wave--1" d="M31.4 17.4c2.5 3.7 2.5 9 0 12.8" />
            <path className="unmute__wave unmute__wave--2" d="M36.8 13.4c4.4 6.2 4.4 15.5 0 21.2" />
          </g>
          <line className="unmute__slash" x1="8.3" y1="10.6" x2="35.1" y2="37.4" />
        </svg>
      </button>
      <p className="unmute__label">
        <span className="unmute__label-text unmute__label-text--off">Tap for sound</span>
        <span className="unmute__label-text unmute__label-text--on">Sound on</span>
      </p>
    </div>
  )
}
