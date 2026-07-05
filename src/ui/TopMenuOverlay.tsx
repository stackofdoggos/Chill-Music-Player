import { useEffect, useState } from 'react'
import { useUi, type TopMenu } from '../state/ui'
import { SettingsMenu } from './SettingsPanel'
import { DayNightMenu } from './DayNightSlider'

const OVERLAY_EXIT_MS = 320
const PANEL_SWAP_MS = 200

function blurMenuTriggers() {
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>('.settings-gear')?.blur()
    document.querySelector<HTMLElement>('.daynight-dot')?.blur()
    ;(document.activeElement as HTMLElement | null)?.blur()
  })
}

export function TopMenuOverlay() {
  const activeMenu = useUi((s) => s.activeMenu)
  const setActiveMenu = useUi((s) => s.setActiveMenu)
  const [shown, setShown] = useState(activeMenu !== 'none')
  const [overlayLeaving, setOverlayLeaving] = useState(false)
  const [renderedMenu, setRenderedMenu] = useState<TopMenu>(activeMenu)
  const [panelLeaving, setPanelLeaving] = useState(false)

  useEffect(() => {
    if (activeMenu === 'none') {
      if (!shown) return
      setOverlayLeaving(true)
      setPanelLeaving(true)
      const id = window.setTimeout(() => {
        setShown(false)
        setOverlayLeaving(false)
        setPanelLeaving(false)
        setRenderedMenu('none')
      }, OVERLAY_EXIT_MS)
      return () => window.clearTimeout(id)
    }

    setShown(true)
    setOverlayLeaving(false)

    if (renderedMenu === activeMenu) return

    if (renderedMenu !== 'none') {
      setPanelLeaving(true)
      const id = window.setTimeout(() => {
        setRenderedMenu(activeMenu)
        setPanelLeaving(false)
      }, PANEL_SWAP_MS)
      return () => window.clearTimeout(id)
    }

    setRenderedMenu(activeMenu)
    setPanelLeaving(false)
  }, [activeMenu, shown, renderedMenu])

  useEffect(() => {
    if (activeMenu === 'none') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenu('none')
        blurMenuTriggers()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeMenu, setActiveMenu])

  if (!shown) return null

  const close = () => setActiveMenu('none')

  return (
    <div
      className={`topmenu-overlay${overlayLeaving ? ' topmenu-overlay--exit' : ''}`}
      onClick={close}
    >
      <div onClick={(e) => e.stopPropagation()}>
        {renderedMenu === 'settings' && (
          <SettingsMenu key="settings" leaving={panelLeaving} onClose={close} />
        )}
        {renderedMenu === 'light' && (
          <DayNightMenu key="light" leaving={panelLeaving} onClose={close} />
        )}
      </div>
    </div>
  )
}
