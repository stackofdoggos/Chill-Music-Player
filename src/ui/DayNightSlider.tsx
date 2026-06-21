import { phaseLabel } from '../scene/dayNight'
import { useStore } from '../state/store'

export function DayNightSlider() {
  const dayPhase = useStore((s) => s.dayPhase)
  const setDayPhase = useStore((s) => s.setDayPhase)
  const label = phaseLabel(dayPhase)

  return (
    <div className="daynight" aria-label="Day-night lighting cycle (dev)">
      <div className="daynight__header">
        <span className="daynight__title">Light</span>
        <span className="daynight__label">{label}</span>
      </div>
      <div className="daynight__track-wrap">
        <div className="daynight__track" />
        <input
          type="range"
          className="daynight__input"
          min={0}
          max={1}
          step={0.001}
          value={dayPhase}
          onChange={(e) => setDayPhase(parseFloat(e.target.value))}
        />
      </div>
    </div>
  )
}
