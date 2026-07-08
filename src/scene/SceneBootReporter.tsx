import { useEffect } from 'react'
import { useProgress } from '@react-three/drei'
import { useBoot } from '../state/boot'

/** Bridges drei loading progress to the boot store (must live inside Canvas). */
export function SceneBootReporter() {
  const { progress, active } = useProgress()

  useEffect(() => {
    useBoot.getState().setScene(progress / 100, !active && progress >= 100)
  }, [progress, active])

  return null
}
