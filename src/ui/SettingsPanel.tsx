import { useEffect } from 'react'
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

  useEffect(() => {
    if (!s.panelOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') s.setPanelOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [s.panelOpen, s])

  return (
    <>
      <button
        type="button"
        className="settings-gear"
        aria-label="Graphics settings"
        onClick={() => s.setPanelOpen(!s.panelOpen)}
      >
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Zm0 5.7a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2Zm7.9-2.1c0-.36-.03-.7-.08-1.04l1.72-1.34a.5.5 0 0 0 .12-.64l-1.63-2.82a.5.5 0 0 0-.61-.22l-2.03.82c-.54-.42-1.14-.77-1.79-1.04l-.31-2.16A.5.5 0 0 0 14.8 3h-3.26a.5.5 0 0 0-.5.43l-.3 2.16c-.65.27-1.25.62-1.8 1.04l-2.02-.82a.5.5 0 0 0-.61.22L4.68 8.85a.5.5 0 0 0 .12.64l1.72 1.34c-.05.34-.08.68-.08 1.04s.03.7.08 1.04l-1.72 1.34a.5.5 0 0 0-.12.64l1.63 2.82c.13.22.39.31.61.22l2.03-.82c.54.42 1.14.77 1.79 1.04l.31 2.16c.04.25.25.43.5.43h3.26a.5.5 0 0 0 .5-.43l.3-2.16a7.4 7.4 0 0 0 1.8-1.04l2.02.82c.23.09.49 0 .61-.22l1.63-2.82a.5.5 0 0 0-.12-.64l-1.72-1.34c.05-.34.08-.68.08-1.04Z"
          />
        </svg>
      </button>

      {s.panelOpen && (
        <div className="settings-overlay" onClick={() => s.setPanelOpen(false)}>
          <div className="settings" role="dialog" aria-label="Graphics settings" onClick={(e) => e.stopPropagation()}>
            <div className="settings__head">
              <span className="settings__title">Graphics</span>
              <button type="button" className="settings__close" aria-label="Close" onClick={() => s.setPanelOpen(false)}>
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
