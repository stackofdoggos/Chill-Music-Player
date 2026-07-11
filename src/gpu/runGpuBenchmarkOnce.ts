import { runGpuBenchmark } from './benchmark'
import { useSettings } from '../state/settings'

let running: Promise<void> | null = null

/** First visit only — sets resolution to `high` or `auto`; other graphics stay at defaults. */
export function runGpuBenchmarkOnce(): Promise<void> {
  if (running) return running

  const go = async () => {
    if (useSettings.getState().gpuBenchmarked) return

    const result = await runGpuBenchmark()
    useSettings.getState().applyGpuBenchmark(result.mode)

    if (import.meta.env.DEV) {
      console.info(
        `[gpu benchmark] → ${result.mode} (${result.medianMs.toFixed(1)}ms median, ${result.renderer})`,
      )
      ;(window as unknown as { __gpuBenchmark: typeof runGpuBenchmark }).__gpuBenchmark =
        runGpuBenchmark
    }
  }

  running = new Promise<void>((resolve) => {
    const start = () => {
      void go().finally(resolve)
    }
    if (useSettings.persist.hasHydrated()) start()
    else useSettings.persist.onFinishHydration(start)
  })

  return running
}
