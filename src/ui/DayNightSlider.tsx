import { useMemo } from 'react'
import { phaseAccentHex, phaseLabel, phaseMarks, phaseTrackGradient } from '../scene/dayNight'
import { useStore } from '../state/store'

const MARKS = phaseMarks()
const TRACK_GRADIENT = phaseTrackGradient()

function MoonIcon() {
  return (
    <svg className="daynight__icon" viewBox="0 0 16 16" aria-hidden>
      <path
        d="M11.2 2.4a5.6 5.6 0 1 0 2.4 9.8A5.6 5.6 0 0 1 11.2 2.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg className="daynight__icon" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <g stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
        <line x1="8" y1="1.4" x2="8" y2="3.2" />
        <line x1="8" y1="12.8" x2="8" y2="14.6" />
        <line x1="1.4" y1="8" x2="3.2" y2="8" />
        <line x1="12.8" y1="8" x2="14.6" y2="8" />
        <line x1="3.3" y1="3.3" x2="4.6" y2="4.6" />
        <line x1="11.4" y1="11.4" x2="12.7" y2="12.7" />
        <line x1="3.3" y1="12.7" x2="4.6" y2="11.4" />
        <line x1="11.4" y1="4.6" x2="12.7" y2="3.3" />
      </g>
    </svg>
  )
}

export function DayNightSlider() {
  const dayPhase = useStore((s) => s.dayPhase)
  const setDayPhase = useStore((s) => s.setDayPhase)
  const label = phaseLabel(dayPhase)
  const accent = useMemo(() => phaseAccentHex(dayPhase), [dayPhase])
  const fill = `${dayPhase * 100}%`

  return (
    <div
      className="daynight"
      style={
        {
          '--daynight-accent': accent,
          '--daynight-fill': fill,
          '--daynight-track': `linear-gradient(90deg, ${TRACK_GRADIENT})`,
        } as React.CSSProperties
      }
      aria-label="Day-night lighting cycle"
    >
      <div className="daynight__header">
        <span className="daynight__title">Light</span>
        <span className="daynight__label">
          <span className="daynight__swatch" aria-hidden />
          {label}
        </span>
      </div>

      <div className="daynight__row">
        <MoonIcon />
        <div className="daynight__track-wrap">
          <div className="daynight__channel">
            <div className="daynight__track" />
            <div className="daynight__fill" />
            <div className="daynight__ticks" aria-hidden>
              {MARKS.map(({ t, label: markLabel }) => (
                <span
                  key={markLabel}
                  className="daynight__tick"
                  style={{ left: `${t * 100}%` }}
                  title={markLabel}
                />
              ))}
            </div>
          </div>
          <input
            type="range"
            className="daynight__input"
            min={0}
            max={1}
            step={0.001}
            value={dayPhase}
            onChange={(e) => setDayPhase(parseFloat(e.target.value))}
            aria-valuetext={label}
          />
        </div>
        <SunIcon />
      </div>
    </div>
  )
}
