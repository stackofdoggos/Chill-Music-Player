/**
 * Procedurally synthesized foley. Everything is generated as AudioBuffers at
 * init time (after the user gesture creates the AudioContext) so there are no
 * sound files to license or load.
 */

export type SfxName =
  | 'needleDrop'
  | 'needleLift'
  | 'switchOn'
  | 'switchOff'
  | 'knobTick'
  | 'sleeveOut'
  | 'sleeveIn'
  | 'vinylOut'
  | 'recordPlace'
  | 'lid'

type Buffers = Record<SfxName, AudioBuffer> & { crackleLoop: AudioBuffer; humLoop: AudioBuffer }

function buffer(ctx: AudioContext, seconds: number, fill: (data: Float32Array, sr: number) => void): AudioBuffer {
  const sr = ctx.sampleRate
  const buf = ctx.createBuffer(1, Math.max(1, Math.floor(seconds * sr)), sr)
  fill(buf.getChannelData(0), sr)
  return buf
}

/** simple one-pole lowpass applied in place */
function lowpass(data: Float32Array, alpha: number) {
  let y = 0
  for (let i = 0; i < data.length; i++) {
    y += alpha * (data[i] - y)
    data[i] = y
  }
}

function highpass(data: Float32Array, alpha: number) {
  let yPrev = 0
  let xPrev = 0
  for (let i = 0; i < data.length; i++) {
    const x = data[i]
    const y = alpha * (yPrev + x - xPrev)
    data[i] = y
    yPrev = y
    xPrev = x
  }
}

/** soft thump: decaying sine with downward pitch sweep */
function thump(data: Float32Array, sr: number, f0: number, f1: number, decay: number, amp: number) {
  let phase = 0
  for (let i = 0; i < data.length; i++) {
    const t = i / sr
    const f = f0 + (f1 - f0) * Math.min(1, t * 8)
    phase += (2 * Math.PI * f) / sr
    data[i] += amp * Math.sin(phase) * Math.exp(-t / decay)
  }
}

function click(data: Float32Array, sr: number, at: number, dur: number, amp: number) {
  const start = Math.floor(at * sr)
  const n = Math.floor(dur * sr)
  for (let i = 0; i < n && start + i < data.length; i++) {
    const env = Math.exp(-i / (n * 0.25))
    data[start + i] += amp * env * (Math.random() * 2 - 1)
  }
}

/** filtered noise swish with a smooth attack/release envelope */
function swish(data: Float32Array, sr: number, dur: number, amp: number, lpAlpha: number) {
  const n = Math.min(data.length, Math.floor(dur * sr))
  const tmp = new Float32Array(n)
  for (let i = 0; i < n; i++) tmp[i] = Math.random() * 2 - 1
  lowpass(tmp, lpAlpha)
  highpass(tmp, 0.95)
  for (let i = 0; i < n; i++) {
    const t = i / n
    const env = Math.sin(Math.PI * Math.pow(t, 0.7)) // fast attack, long tail
    data[i] += amp * tmp[i] * env
  }
}

export function buildSfx(ctx: AudioContext): Buffers {
  // --- vinyl surface noise loop: faint hiss + random ticks and pops ---
  const crackleLoop = buffer(ctx, 4, (d, sr) => {
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.012
    lowpass(d, 0.12)
    // small ticks (~1/3 previous density)
    for (let k = 0; k < 37; k++) {
      click(d, sr, Math.random() * 3.96, 0.002 + Math.random() * 0.004, 0.05 + Math.random() * 0.12)
    }
    // a few larger pops (~1/3 previous density)
    for (let k = 0; k < 2; k++) {
      const at = Math.random() * 3.9
      click(d, sr, at, 0.012, 0.3 + Math.random() * 0.25)
      thumpAt(d, sr, at, 90, 0.02, 0.12)
    }
    highpass(d, 0.6)
  })

  // --- motor hum loop: 60Hz + harmonics, very quiet, slightly unstable ---
  const humLoop = buffer(ctx, 2, (d, sr) => {
    for (let i = 0; i < d.length; i++) {
      const t = i / sr
      const wobble = 1 + 0.002 * Math.sin(2 * Math.PI * 0.7 * t)
      d[i] =
        0.5 * Math.sin(2 * Math.PI * 60 * wobble * t) +
        0.22 * Math.sin(2 * Math.PI * 120 * wobble * t) +
        0.08 * Math.sin(2 * Math.PI * 180 * t)
    }
    // crossfade-free loop: lengths are integer multiples of the periods
  })

  const needleDrop = buffer(ctx, 0.7, (d, sr) => {
    thump(d, sr, 110, 45, 0.06, 0.55)
    click(d, sr, 0.004, 0.006, 0.35)
    // static burst as the stylus settles
    for (let k = 0; k < 14; k++) click(d, sr, 0.05 + Math.random() * 0.5, 0.003, 0.1 * Math.random())
  })

  const needleLift = buffer(ctx, 0.3, (d, sr) => {
    click(d, sr, 0.002, 0.005, 0.18)
    thump(d, sr, 130, 80, 0.025, 0.16)
  })

  const switchOn = buffer(ctx, 0.16, (d, sr) => {
    click(d, sr, 0.0, 0.004, 0.5)
    thump(d, sr, 180, 90, 0.018, 0.5)
    click(d, sr, 0.045, 0.005, 0.7)
    thump(d, sr, 140, 70, 0.02, 0.4)
  })

  const switchOff = buffer(ctx, 0.14, (d, sr) => {
    click(d, sr, 0.0, 0.005, 0.6)
    thump(d, sr, 150, 75, 0.018, 0.45)
  })

  const knobTick = buffer(ctx, 0.05, (d, sr) => {
    click(d, sr, 0, 0.0025, 0.4)
    thump(d, sr, 700, 500, 0.004, 0.18)
  })

  const sleeveOut = buffer(ctx, 0.55, (d, sr) => {
    swish(d, sr, 0.55, 0.5, 0.28)
    click(d, sr, 0.48, 0.01, 0.12) // sleeve clearing the neighbours
  })

  const sleeveIn = buffer(ctx, 0.5, (d, sr) => {
    swish(d, sr, 0.45, 0.42, 0.25)
    thump(d, sr, 120, 90, 0.02, 0.2) // soft stop against the shelf
  })

  const vinylOut = buffer(ctx, 0.7, (d, sr) => {
    swish(d, sr, 0.7, 0.35, 0.5) // smoother, glossier friction than cardboard
  })

  const recordPlace = buffer(ctx, 0.4, (d, sr) => {
    thump(d, sr, 95, 50, 0.045, 0.4)
    click(d, sr, 0.012, 0.004, 0.2) // spindle through the centre hole
    click(d, sr, 0.05, 0.003, 0.1)
  })

  const lid = buffer(ctx, 0.5, (d, sr) => {
    swish(d, sr, 0.4, 0.12, 0.1) // hinge friction
    thump(d, sr, 90, 60, 0.03, 0.22)
    click(d, sr, 0.4, 0.008, 0.25) // damped end stop
  })

  return {
    crackleLoop,
    humLoop,
    needleDrop,
    needleLift,
    switchOn,
    switchOff,
    knobTick,
    sleeveOut,
    sleeveIn,
    vinylOut,
    recordPlace,
    lid,
  }
}

function thumpAt(data: Float32Array, sr: number, at: number, f: number, decay: number, amp: number) {
  const start = Math.floor(at * sr)
  for (let i = start; i < data.length; i++) {
    const t = (i - start) / sr
    if (t > decay * 6) break
    data[i] += amp * Math.sin(2 * Math.PI * f * t) * Math.exp(-t / decay)
  }
}
