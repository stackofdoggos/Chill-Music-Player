import { useCallback, useEffect, useState } from 'react'
import { Experience } from './scene/Experience'
import { YandhiIntro } from './loading/YandhiIntro'
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
import { useBoot, waitForAssets } from './state/boot'
import { markIntroSeen, readIntroMode } from './loading/introTimeline'
import { runGpuBenchmarkOnce } from './gpu/runGpuBenchmarkOnce'

export default function App() {
  /** The intro plays on a first visit and then not again for a week; everyone
   *  else goes straight to the room. Read once — it must not change mid-session. */
  const [introMode] = useState(readIntroMode)
  /** true once the room is rendering — done behind the still-opaque intro so
   *  shaders compile before the dissolve rather than during it. */
  const [sceneActive, setSceneActive] = useState(false)
  const [entered, setEntered] = useState(false)
  const [showIntro, setShowIntro] = useState(introMode === 'full')

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

  useEffect(() => {
    if (introMode !== 'none') return
    // Render straight away so shaders compile while the page is still blank,
    // then fade the room up once there is something to look at.
    setSceneActive(true)
    let live = true
    void waitForAssets().then(() => {
      if (!live) return
      markIntroSeen() // keep the week counting from this visit, not the first one
      setEntered(true)
    })

    // Without the unmute gate there has been no gesture, and an AudioContext
    // built outside one starts suspended. Build it on the visitor's first
    // interaction instead — they have to click something to play a record anyway.
    const arm = () => {
      window.removeEventListener('pointerdown', arm)
      window.removeEventListener('keydown', arm)
      void engine
        .init()
        .then(() => engine.setVolume(useStore.getState().volume))
        .catch(() => {})
    }
    window.addEventListener('pointerdown', arm)
    window.addEventListener('keydown', arm)
    return () => {
      live = false
      window.removeEventListener('pointerdown', arm)
      window.removeEventListener('keydown', arm)
    }
  }, [introMode])

  const warmScene = useCallback(() => setSceneActive(true), [])

  const reveal = useCallback(() => {
    // The intro already created the AudioContext on its gesture; this just
    // matches the graph to the stored volume before the room takes over.
    void engine
      .init()
      .then(() => engine.setVolume(useStore.getState().volume))
      .catch(() => {})
    setSceneActive(true)
    setEntered(true)
  }, [])

  const dissolved = useCallback(() => setShowIntro(false), [])

  return (
    <>
      <VinylFavicon />
      <div className={`scene-wrap${entered ? ' scene-wrap--visible' : ''}`}>
        <Experience active={sceneActive} />
      </div>
      {showIntro && (
        <YandhiIntro onWarmScene={warmScene} onReveal={reveal} onDissolved={dissolved} />
      )}
      {entered && <NowPlaying />}
      {entered && <SettingsGear />}
      {entered && <LightDot />}
      {entered && <TopMenuOverlay />}
    </>
  )
}
