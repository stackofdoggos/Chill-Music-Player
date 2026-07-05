import { useRef } from 'react'
import { useSettings, type ResolutionMode, type ShaftMode } from '../state/settings'
import { useUi } from '../state/ui'

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

export function SettingsGear() {
  const open = useUi((s) => s.activeMenu === 'settings')
  const toggleMenu = useUi((s) => s.toggleMenu)
  const gearRef = useRef<HTMLButtonElement>(null)

  return (
    <button
      ref={gearRef}
      type="button"
      className={`settings-gear${open ? ' settings-gear--open' : ''}`}
      aria-label="Graphics settings"
      aria-expanded={open}
      onClick={() => toggleMenu('settings')}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="0.93"
          strokeLinejoin="round"
          d="M12 1.8 15 2.25 14.18 4.93 15.46 5.46 16.77 2.99 19.21 4.79 21.01 7.23 18.54 8.54 19.07 9.82 21.75 9 22.2 12 21.75 15 19.07 14.18 18.54 15.46 21.01 16.77 19.21 19.21 16.77 21.01 15.46 18.54 14.18 19.07 15 21.75 12 22.2 9 21.75 9.82 19.07 8.54 18.54 7.23 21.01 4.79 19.21 2.99 16.77 5.46 15.46 4.93 14.18 2.25 15 1.8 12 2.25 9 4.93 9.82 5.46 8.54 2.99 7.23 4.79 4.79 7.23 2.99 8.54 5.46 9.82 4.93 9 2.25 12 1.8Z"
        />
        <circle cx="12" cy="12" r="3.6" fill="none" stroke="currentColor" strokeWidth="0.93" />
      </svg>
    </button>
  )
}

export function SettingsMenu({
  leaving,
  onClose,
}: {
  leaving: boolean
  onClose: () => void
}) {
  const s = useSettings()

  return (
    <div
      className={`settings${leaving ? ' settings--exit' : ''}`}
      role="dialog"
      aria-label="Graphics settings"
    >
      <div className="settings__head">
        <span className="settings__title">Graphics</span>
        <button type="button" className="settings__close" aria-label="Close" onClick={onClose}>
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
          <div className="settings__hint">Auto softens at golden hour; High at night</div>
        </div>
        <Segmented<ResolutionMode>
          value={s.resolutionMode}
          onChange={s.setResolutionMode}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'standard', label: 'Standard' },
            { value: 'high', label: 'High' },
          ]}
        />
      </div>
    </div>
  )
}

/** @deprecated import SettingsGear directly */
export function SettingsPanel() {
  return <SettingsGear />
}
