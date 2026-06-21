/**
 * Mix of sampled foley (`public/sfx/`) and procedural one-shots.
 * Built after the user gesture creates the AudioContext.
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

type LoopName = 'crackleLoop'
type Buffers = Record<SfxName, AudioBuffer> & Record<LoopName, AudioBuffer>

type SampleSpec = { file: string; peak: number }

const SAMPLES: Record<Exclude<SfxName, 'needleLift' | 'knobTick' | 'recordPlace' | 'lid'> | LoopName, SampleSpec> = {
  needleDrop: { file: 'needle-drop.mp3', peak: 0.75 },
  switchOn: { file: 'switch-on.mp3', peak: 0.75 },
  switchOff: { file: 'switch-off.mp3', peak: 0.75 },
  sleeveOut: { file: 'sleeve-out.mp3', peak: 0.375 },
  sleeveIn: { file: 'sleeve-in.mp3', peak: 0.75 },
  vinylOut: { file: 'vinyl-out.mp3', peak: 0.75 },
  crackleLoop: { file: 'crackle-loop.mp3', peak: 0.2 },
}

async function decodeSample(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`failed to load ${url}`)
  return ctx.decodeAudioData(await res.arrayBuffer())
}

function normalizePeak(buf: AudioBuffer, target: number): AudioBuffer {
  let peak = 0
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c)
    for (let i = 0; i < ch.length; i++) peak = Math.max(peak, Math.abs(ch[i]))
  }
  if (peak <= 1e-6) return buf
  const g = target / peak
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c)
    for (let i = 0; i < ch.length; i++) ch[i] *= g
  }
  return buf
}

function buffer(ctx: AudioContext, seconds: number, fill: (data: Float32Array, sr: number) => void): AudioBuffer {
  const sr = ctx.sampleRate
  const buf = ctx.createBuffer(1, Math.max(1, Math.floor(seconds * sr)), sr)
  fill(buf.getChannelData(0), sr)
  return buf
}

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

function swish(data: Float32Array, sr: number, dur: number, amp: number, lpAlpha: number) {
  const n = Math.min(data.length, Math.floor(dur * sr))
  const tmp = new Float32Array(n)
  for (let i = 0; i < n; i++) tmp[i] = Math.random() * 2 - 1
  lowpass(tmp, lpAlpha)
  highpass(tmp, 0.95)
  for (let i = 0; i < n; i++) {
    const t = i / n
    const env = Math.sin(Math.PI * Math.pow(t, 0.7))
    data[i] += amp * tmp[i] * env
  }
}

async function loadSample(ctx: AudioContext, spec: SampleSpec): Promise<AudioBuffer> {
  return normalizePeak(await decodeSample(ctx, `/sfx/${spec.file}`), spec.peak)
}

function buildProcedural(ctx: AudioContext): Pick<Buffers, 'needleLift' | 'knobTick' | 'recordPlace' | 'lid'> {
  const needleLift = buffer(ctx, 0.3, (d, sr) => {
    click(d, sr, 0.002, 0.005, 0.18)
    thump(d, sr, 130, 80, 0.025, 0.16)
  })

  const knobTick = buffer(ctx, 0.05, (d, sr) => {
    click(d, sr, 0, 0.0025, 0.4)
    thump(d, sr, 700, 500, 0.004, 0.18)
  })

  const recordPlace = buffer(ctx, 0.4, (d, sr) => {
    thump(d, sr, 95, 50, 0.045, 0.4)
    click(d, sr, 0.012, 0.004, 0.2)
    click(d, sr, 0.05, 0.003, 0.1)
  })

  const lid = buffer(ctx, 0.5, (d, sr) => {
    swish(d, sr, 0.4, 0.12, 0.1)
    thump(d, sr, 90, 60, 0.03, 0.22)
    click(d, sr, 0.4, 0.008, 0.25)
  })

  return { needleLift, knobTick, recordPlace, lid }
}

export async function buildSfx(ctx: AudioContext): Promise<Buffers> {
  const procedural = buildProcedural(ctx)
  const sampled = await Promise.all(
    (Object.keys(SAMPLES) as (keyof typeof SAMPLES)[]).map(async (name) => [name, await loadSample(ctx, SAMPLES[name])] as const),
  )
  return { ...Object.fromEntries(sampled), ...procedural } as Buffers
}
