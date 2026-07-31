import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { TIMING } from './assembleConfig'

type BuildTimeline = (tl: gsap.core.Timeline) => void

/**
 * Builds a looping GSAP timeline. `build` receives a fresh timeline each loop
 * and should only animate object transforms (no React state).
 */
export function useAssembleLoop(active: boolean, build: BuildTimeline, deps: unknown[]) {
  const buildRef = useRef(build)
  buildRef.current = build

  useEffect(() => {
    if (!active) return

    let cancelled = false
    let current: gsap.core.Timeline | null = null

    const run = () => {
      if (cancelled) return
      current?.kill()
      const tl = gsap.timeline({
        onComplete: () => {
          if (cancelled) return
          gsap.delayedCall(TIMING.loopGap, run)
        },
      })
      current = tl
      buildRef.current(tl)
    }

    run()
    return () => {
      cancelled = true
      current?.kill()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ...deps])
}
