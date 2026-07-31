import { useEffect, useRef, useState } from 'react'
import { Experience } from './scene/Experience'
import { LoadingAssemble } from './loading/LoadingAssemble'
import { NowPlaying } from './ui/NowPlaying'
import { LightDot } from './ui/DayNightSlider'
import { VinylFavicon } from './ui/Favicon'
import { loadAlbums } from './albums'
import { requestUnfocus, useStore } from './state/store'
import { useUi } from './state/ui'
import { SettingsGear } from './ui/SettingsPanel'
import { TopMenuOverlay } from './ui/TopMenuOverlay'
import { engine } from './audio/engine'
import { preloadSceneAssets } from './scene/preloadScene'
import { useBoot } from './state/boot'
import { runGpuBenchmarkOnce } from './gpu/runGpuBenchmarkOnce'

/** Keep boot long enough for one assemble cycle to read as intentional. */
const MIN_BOOT_MS = 5200

export default function App() {
  const [ready, setReady] = useState(false)
  const [entered, setEntered] = useState(false)
  const [showLoading, setShowLoading] = useState(true)
  const bootStart = useRef(performance.now())

  useEffect(() => {
    preloadSceneAssets()
    void runGpuBenchmarkOnce()
  }, [])

  useEffect(() => {
    let cancelled = false
    loadAlbums((done, total) => {
      if (cancelled) return
      useBoot.getState().setAlbums(total ? done / total : 0)
    }).then((albums) => {
      if (cancelled) return
      useStore.getState().setAlbums(albums)
      useBoot.getState().setAlbums(1)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let id = 0
    const tick = () => {
      const elapsed = performance.now() - bootStart.current
      const { albumsReady, sceneReady } = useBoot.getState()
      if (albumsReady && sceneReady && elapsed >= MIN_BOOT_MS) {
        setReady(true)
        return
      }
      id = requestAnimationFrame(tick)
    }

    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useUi.getState().activeMenu !== 'none') return
      if (e.key === 'Escape') requestUnfocus()
      else if (e.key === 'f' || e.key === 'F') useStore.getState().flipSleeve()
      else if (e.key === 'p' || e.key === 'P') {
        const action = useStore.getState().pressP()
        if (action === 'putBack') engine.playSfx('sleeveIn', 0.85, 1.05)
        else if (action === 'select') engine.playSfx('sleeveOut', 0.85, 0.95 + Math.random() * 0.1)
        else if (action === 'swap') {
          engine.playSfx('sleeveOut', 0.85, 0.95 + Math.random() * 0.1)
          engine.playSfx('sleeveIn', 0.85, 1.05)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const enter = async () => {
    await engine.init()
    engine.setVolume(useStore.getState().volume)
    setEntered(true)
  }

  return (
    <>
      <VinylFavicon />
      <div className={`scene-wrap${entered ? ' scene-wrap--visible' : ''}`}>
        <Experience active={entered} />
      </div>
      {showLoading && (
        <LoadingAssemble
          ready={ready}
          entered={entered}
          onEnter={enter}
          onDissolved={() => setShowLoading(false)}
        />
      )}
      {entered && <NowPlaying />}
      {entered && <SettingsGear />}
      {entered && <LightDot />}
      {entered && <TopMenuOverlay />}
    </>
  )
}
