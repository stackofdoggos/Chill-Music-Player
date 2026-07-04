import { useEffect, useRef, useState } from 'react'
import { useSettings, type ShaftMode } from '../state/settings'

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`settings__toggle${checked ? ' settings__toggle--on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="settings__toggle-knob" />
    </button>
  )
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="settings__segmented" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={`settings__segment${value === o.value ? ' settings__segment--active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function SettingsPanel() {
  const s = useSettings()
  const open = s.panelOpen
  const [shown, setShown] = useState(open)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (open) {
      setShown(true)
      setLeaving(false)
      return
    }
    if (!shown) return
    setLeaving(true)
    const id = window.setTimeout(() => {
      setShown(false)
      setLeaving(false)
    }, 320)
    return () => window.clearTimeout(id)
  }, [open, shown])

  const gearRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        s.setPanelOpen(false)
        // Escape returns focus to the trigger — blur so the cog doesn't highlight
        requestAnimationFrame(() => gearRef.current?.blur())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, s])

  const close = () => s.setPanelOpen(false)

  return (
    <>
      <button
        ref={gearRef}
        type="button"
        className={`settings-gear${open ? ' settings-gear--open' : ''}`}
        aria-label="Graphics settings"
        aria-expanded={open}
        onClick={() => s.setPanelOpen(!open)}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.85"
            strokeLinejoin="round"
            d="M12 1.8 15 2.25 14.18 4.93 15.46 5.46 16.77 2.99 19.21 4.79 21.01 7.23 18.54 8.54 19.07 9.82 21.75 9 22.2 12 21.75 15 19.07 14.18 18.54 15.46 21.01 16.77 19.21 19.21 16.77 21.01 15.46 18.54 14.18 19.07 15 21.75 12 22.2 9 21.75 9.82 19.07 8.54 18.54 7.23 21.01 4.79 19.21 2.99 16.77 5.46 15.46 4.93 14.18 2.25 15 1.8 12 2.25 9 4.93 9.82 5.46 8.54 2.99 7.23 4.79 4.79 7.23 2.99 8.54 5.46 9.82 4.93 9 2.25 12 1.8Z"
          />
          <circle cx="12" cy="12" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.85" />
        </svg>
      </button>

      {shown && (
        <div
          className={`settings-overlay${leaving ? ' settings-overlay--exit' : ''}`}
          onClick={close}
        >
          <div
            className={`settings${leaving ? ' settings--exit' : ''}`}
            role="dialog"
            aria-label="Graphics settings"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="settings__head">
              <span className="settings__title">Graphics</span>
              <button type="button" className="settings__close" aria-label="Close" onClick={close}>
                ✕
              </button>
            </div>

            <div className="settings__row">
              <div>
                <div className="settings__label">Soft shadows</div>
                <div className="settings__hint">Area-light shadows that soften with distance</div>
              </div>
              <Toggle checked={s.softShadows} onChange={s.setSoftShadows} />
            </div>

            <div className="settings__row">
              <div>
                <div className="settings__label">Ambient occlusion</div>
                <div className="settings__hint">Contact shading in shelves and corners</div>
              </div>
              <Toggle checked={s.ambientOcclusion} onChange={s.setAmbientOcclusion} />
            </div>

            <div className="settings__row settings__row--stack">
              <div>
                <div className="settings__label">Light shafts</div>
                <div className="settings__hint">Sunbeams and dust by the window</div>
              </div>
              <Segmented<ShaftMode>
                value={s.lightShafts}
                onChange={s.setLightShafts}
                options={[
                  { value: 'off', label: 'Off' },
                  { value: 'subtle', label: 'Subtle' },
                  { value: 'pronounced', label: 'Pronounced' },
                ]}
              />
            </div>

            <div className="settings__row settings__row--stack">
              <div>
                <div className="settings__label">Resolution</div>
                <div className="settings__hint">Standard renders at 1× for slower machines</div>
              </div>
              <Segmented<'standard' | 'high'>
                value={s.highRes ? 'high' : 'standard'}
                onChange={(v) => s.setHighRes(v === 'high')}
                options={[
                  { value: 'standard', label: 'Standard' },
                  { value: 'high', label: 'High' },
                ]}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
