import { useEffect, useRef, useState } from 'react'
import { Experience } from './scene/Experience'
import { LoadingScreen } from './ui/LoadingScreen'
import { NowPlaying } from './ui/NowPlaying'
import { loadAlbums } from './albums'
import { requestUnfocus, useStore } from './state/store'
import { engine } from './audio/engine'

const BOOT_STATUS = [
  'Fetching catalog…',
  'Loading sleeve artwork…',
  'Indexing tracks…',
  'Preparing audio engine…',
  'Generating scene…',
  'Calibrating tonearm…',
  'Warming the room…',
] as const

const MIN_BOOT_MS = 5200
const STATUS_MS = MIN_BOOT_MS / BOOT_STATUS.length

export default function App() {
  const [loadProgress, setLoadProgress] = useState(0)
  const [loadStatus, setLoadStatus] = useState<string>(BOOT_STATUS[0])
  const [ready, setReady] = useState(false)
  const [entered, setEntered] = useState(false)
  const [showLoading, setShowLoading] = useState(true)
  const assetsReady = useRef(false)
  const bootStart = useRef(performance.now())

  useEffect(() => {
    let cancelled = false
    loadAlbums(() => {}).then((albums) => {
      if (cancelled) return
      useStore.getState().setAlbums(albums)
      assetsReady.current = true
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let id = 0
    const tick = () => {
      const elapsed = performance.now() - bootStart.current
      const step = Math.min(BOOT_STATUS.length - 1, Math.floor(elapsed / STATUS_MS))
      setLoadStatus(BOOT_STATUS[step])

      const timeTarget = Math.min(1, elapsed / MIN_BOOT_MS)
      const cap = assetsReady.current ? 1 : Math.min(0.8, timeTarget)
      setLoadProgress((p) => {
        const eased = p + (Math.min(timeTarget, cap) - p) * 0.06
        return Math.min(cap, eased + 0.0015)
      })

      if (assetsReady.current && elapsed >= MIN_BOOT_MS) {
        setLoadProgress(1)
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
      if (e.key === 'Escape') requestUnfocus()
      else if (e.key === 'f' || e.key === 'F') useStore.getState().flipSleeve()
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
      {ready && (
        <div className={`scene-wrap${entered ? ' scene-wrap--visible' : ''}`}>
          <Experience />
        </div>
      )}
      {showLoading && (
        <LoadingScreen
          progress={loadProgress}
          status={loadStatus}
          ready={ready}
          entered={entered}
          onEnter={enter}
          onDissolved={() => setShowLoading(false)}
        />
      )}
      {entered && <NowPlaying />}
    </>
  )
}
