import { useEffect, useState } from 'react'
import { Experience } from './scene/Experience'
import { LoadingScreen } from './ui/LoadingScreen'
import { NowPlaying } from './ui/NowPlaying'
import { loadAlbums } from './albums'
import { useStore } from './state/store'
import { engine } from './audio/engine'

export default function App() {
  const [progress, setProgress] = useState(0)
  const [ready, setReady] = useState(false)
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadAlbums((done, total) => setProgress(total ? done / total : 1)).then((albums) => {
      if (cancelled) return
      useStore.getState().setAlbums(albums)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useStore.getState().setView('overview')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const enter = () => {
    engine.init()
    engine.setVolume(useStore.getState().volume)
    setEntered(true)
  }

  return (
    <>
      {entered && <Experience />}
      <LoadingScreen progress={progress} ready={ready} entered={entered} onEnter={enter} />
      {entered && <NowPlaying />}
    </>
  )
}
