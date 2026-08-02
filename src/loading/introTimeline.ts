import { assetUrl } from '../assetUrl'

/**
 * Constants for the Yandhi intro, measured off the Blender renders in
 * `public/loading/`. All three clips are 30fps 1920x1080:
 *
 *   yandhi_assemble.mp4     390 frames / 13.000s
 *   yandhi_spin.mp4         150 frames /  5.000s  = exactly one 360 deg revolution
 *   yandhi_disassemble.mp4  267 frames /  8.900s  = reverse(assemble[0..266])
 *
 * The renders share one rotation rig at 72 deg/s, so they are phase-locked:
 *
 *   assemble[389] == spin[149]   -> assemble can hand off to spin[0] mid-rotation
 *   assemble[266] == spin[26]    -> the face-on pose, and disassemble[0]
 *
 * Every clip change below lands on one of those pairs, which is why none of them
 * need a crossfade. If the clips are ever re-rendered, re-measure before trusting
 * these numbers: extract frames as raw gray/rgb and compare with SAD (a match is
 * well under 1.0, adjacent frames differ by ~2.2).
 */
const FPS = 30

export const CLIPS = {
  assemble: assetUrl('loading/yandhi_assemble.mp4'),
  spin: assetUrl('loading/yandhi_spin.mp4'),
  disassemble: assetUrl('loading/yandhi_disassemble.mp4'),
  /** Extracted from vinyl_assemble_1080_audio.mp4, so it lines up with frame 0. */
  music: assetUrl('loading/yandhi_intro.m4a'),
} as const

export const ASSEMBLE_DURATION = 390 / FPS
export const SPIN_DURATION = 150 / FPS
/**
 * Record face-on to camera, and the pixels the disassemble clip opens on.
 * Parking the spin loop here makes the cut into the outro invisible. The half
 * frame keeps `currentTime` inside frame 26 rather than on its boundary, where
 * browsers disagree about which frame to paint.
 */
export const SPIN_FACE_ON = 26.5 / FPS

/** The intro track's level. It plays over a still room, so it sits back a little. */
export const MUSIC_VOLUME = 0.1

/**
 * The outro ends by opening the room out of the record's spindle hole, which
 * works because the assemble was rendered starting *inside* that hole and
 * pulling back — so reversed, the outro flies into it.
 *
 * Freeze on `disassemble[250]` (== `assemble[16]`): that frame is pure white
 * edge to edge (0% of it darker than 120) with the hole a grey disc dead centre,
 * so the iris opens through flat colour with no detail to give its edge away.
 * The white measures 253 — the same as `--intro-void`.
 *
 * **Do not let it run past `disassemble[255]`.** `assemble[0..10]` is the blank
 * sleeve held pixel-identical and `assemble[11]` hard-cuts to the close-up, so
 * that cut lands at `disassemble[256]`, six frames past the freeze. The trigger
 * fires early and then snaps, because snapping *back* a frame or two is
 * invisible on a still whereas overshooting shows the cut.
 */
export const IRIS = {
  /** Start watching here; polling can overshoot by a frame or two. */
  trigger: 249 / FPS,
  /** Snap to this. The half frame keeps `currentTime` inside frame 250. */
  frame: 250.5 / FPS,
  /** The hole's radius on that frame, as a fraction of the clip's height. */
  startRadius: 0.09,
  /**
   * How long the whole reveal runs, and so how long the music has to fade under
   * it. The hole itself is done sooner — see .scene-wrap--iris-open in
   * styles.css, where it finishes early so the room's chrome isn't left waiting
   * behind the intro — but the push-in lasts this long.
   */
  openMs: 1000,
  /** The room starts pushed in this far and settles back as the hole opens. */
  roomScale: 1.08,
} as const

/**
 * When the assemble's shatter stops reaching the frame edge, and the clips go
 * back to being a record on flat void. The intro bleeds edge to edge up to here
 * and sits inset afterwards, because the settled record is too tall to survive
 * a full-bleed crop on a wide window (see .intro__clip in styles.css).
 *
 *   assemble     touches the border over frames  18..252
 *   disassemble  touches the border over frames  14..248
 *   spin         never touches it
 *
 * Measured by scanning a 3px border of every frame for pixels off the corner
 * value; re-measure the same way if the clips are re-rendered.
 */
export const ASSEMBLE_SETTLES_AT = 252 / FPS

export const TIMING = {
  /** How far into the assemble clip the typing bubble rises. */
  typingAt: 4.5,
  /** Floor on how long the dots show before they can flip to ENTER. */
  typingHold: 2,
  /** Beat held on the face-on frame between the spin loop and the disassemble. */
  faceOnHold: 0.35,
  /** The disassemble plays back faster than it was rendered. */
  disassembleRate: 1.3,
  /**
   * If the next face-on frame is nearer than this when ENTER is clicked, take one
   * more revolution — otherwise an unlucky click cuts to the outro almost
   * instantly and reads as a glitch rather than a deliberate spin.
   */
  minSpinBeforeOutro: 1.5,
  /** Stop waiting for media to buffer and start anyway. */
  bufferTimeout: 25000,
} as const

const LAST_SEEN_KEY = 'chill.introLastSeen'
const FULL_INTRO_AFTER_MS = 7 * 24 * 60 * 60 * 1000

/** `full` = the whole assemble; `none` = straight into the room. */
export type IntroMode = 'full' | 'none'

/**
 * The intro is a first-impression piece, so it plays once and then gets out of
 * the way: a first visit, or a week since the last one, earns the full assemble
 * and every visit in between goes straight to the room.
 * `?intro=full` / `?intro=none` forces a mode without touching storage.
 */
export function readIntroMode(): IntroMode {
  try {
    const forced = new URLSearchParams(window.location.search).get('intro')
    if (forced === 'full' || forced === 'none') return forced
    const last = Number(localStorage.getItem(LAST_SEEN_KEY))
    if (!Number.isFinite(last) || last <= 0) return 'full'
    return Date.now() - last > FULL_INTRO_AFTER_MS ? 'full' : 'none'
  } catch {
    return 'full'
  }
}

export function markIntroSeen() {
  try {
    localStorage.setItem(LAST_SEEN_KEY, String(Date.now()))
  } catch {
    /* private browsing — they just get the full intro again */
  }
}

export function clearIntroMemory() {
  try {
    localStorage.removeItem(LAST_SEEN_KEY)
  } catch {
    /* ignore */
  }
}

/** "ENTER MM DD YY" — the ready-state bubble label. */
export function enterLabel(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `ENTER ${pad(now.getMonth() + 1)} ${pad(now.getDate())} ${pad(now.getFullYear() % 100)}`
}

if (import.meta.env.DEV) {
  ;(window as unknown as { __intro: unknown }).__intro = {
    /** Which intro this reload would show. */
    mode: readIntroMode,
    /** Forget the last visit, so the next reload plays the full assemble. */
    forget: clearIntroMemory,
    /** Pretend the last visit was `days` ago (>7 earns the full intro again). */
    lastSeenDaysAgo(days: number) {
      localStorage.setItem(LAST_SEEN_KEY, String(Date.now() - days * 24 * 60 * 60 * 1000))
    },
    seen: markIntroSeen,
  }
}
