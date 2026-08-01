/** Media helpers for the intro. All poll alongside events, because `timeupdate`
 *  only fires ~4x/second and is too coarse to hit a specific frame. */

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Waits for an event, but gives up after `timeoutMs`. The timeout is what keeps a
 * clip that fails to load or stalls mid-playback from parking the intro on a
 * white screen forever — the sequence moves on instead.
 */
export function once(el: HTMLMediaElement, event: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(cap)
      el.removeEventListener(event, finish)
      resolve()
    }
    const cap = setTimeout(finish, timeoutMs)
    el.addEventListener(event, finish)
  })
}

/** True when the element holds enough data to run to the end without stalling. */
function bufferedThrough(el: HTMLMediaElement): boolean {
  if (el.readyState >= 4) return true
  if (el.readyState < 3 || !Number.isFinite(el.duration) || el.duration <= 0) return false
  const ranges = el.buffered
  return ranges.length > 0 && ranges.end(ranges.length - 1) >= el.duration - 0.25
}

/**
 * Resolves once every element can play through, or after `timeoutMs`. The intro
 * holds on a still frame until this settles so the picture never stalls partway
 * and drift out of sync with the music.
 */
export function waitForBuffered(els: HTMLMediaElement[], timeoutMs: number): Promise<void> {
  if (els.every(bufferedThrough)) return Promise.resolve()
  return new Promise((resolve) => {
    let settled = false
    const check = () => {
      if (settled || !els.every(bufferedThrough)) return
      settled = true
      cleanup()
      resolve()
    }
    const cleanup = () => {
      clearInterval(poll)
      clearTimeout(cap)
      for (const el of els) {
        el.removeEventListener('progress', check)
        el.removeEventListener('canplaythrough', check)
        el.removeEventListener('loadeddata', check)
      }
    }
    const poll = setInterval(check, 120)
    const cap = setTimeout(() => {
      if (settled) return
      settled = true
      cleanup()
      resolve()
    }, timeoutMs)
    for (const el of els) {
      el.addEventListener('progress', check)
      el.addEventListener('canplaythrough', check)
      el.addEventListener('loadeddata', check)
    }
  })
}

/** Resolves when the element's own clock reaches `t` seconds (or it ends). */
export function atTime(el: HTMLMediaElement, t: number): Promise<void> {
  if (el.currentTime >= t) return Promise.resolve()
  return new Promise((resolve) => {
    let settled = false
    const check = () => {
      if (settled || (el.currentTime < t && !el.ended)) return
      settled = true
      clearInterval(poll)
      el.removeEventListener('timeupdate', check)
      el.removeEventListener('ended', check)
      resolve()
    }
    const poll = setInterval(check, 40)
    el.addEventListener('timeupdate', check)
    el.addEventListener('ended', check)
  })
}

/**
 * Nudge `follower` onto `leader`'s clock. Even fully buffered, an audio element
 * starts a few frames behind a video decoder told to play in the same tick —
 * measured at 50-90ms here. Call this just after playback begins, while the
 * track is still in its opening moments, where a correction that small is
 * inaudible; correcting later would be a audible skip.
 */
export function align(follower: HTMLMediaElement, leader: HTMLMediaElement, tolerance = 0.04) {
  const drift = leader.currentTime - follower.currentTime
  if (Math.abs(drift) > tolerance) follower.currentTime = leader.currentTime
  return drift
}

/** Ramp an element's volume down, then pause it. */
export function fadeOut(el: HTMLMediaElement, ms: number) {
  const from = el.volume
  const start = performance.now()
  const step = () => {
    const k = Math.min(1, (performance.now() - start) / ms)
    el.volume = from * (1 - k)
    if (k < 1) requestAnimationFrame(step)
    else el.pause()
  }
  requestAnimationFrame(step)
}
