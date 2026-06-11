import { buildSfx, type SfxName } from './sfx'
import { trackUrl, type Album } from '../albums'
import { useStore } from '../state/store'

const SPIN_UP_RATE = 0.9 // platter acceleration, rev-factor per second
const SPIN_DOWN_RATE = 0.55
const MIN_AUDIBLE_RATE = 0.3 // below this we pause the media element

/**
 * Singleton audio engine. Owns the AudioContext, the music graph
 * (media element -> vinyl EQ -> gain -> master) plus crackle/hum loops and
 * one-shot SFX. Also models the platter: `rate` is the current platter speed
 * as a fraction of nominal 33rpm, and the media playbackRate follows it so
 * spin-up/down produces a real pitch bend (preservesPitch = false).
 */
class AudioEngine {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private musicGain!: GainNode
  private musicIn!: BiquadFilterNode
  private crackleGain!: GainNode
  private crackleSrc!: AudioBufferSourceNode
  private humGain!: GainNode
  private sfx!: ReturnType<typeof buildSfx>
  private el: HTMLAudioElement | null = null

  private album: Album | null = null
  private durations: number[] = []
  private trackIndex = -1
  private dropTimer: ReturnType<typeof setTimeout> | undefined
  private metaHandler: (() => void) | null = null

  needleDown = false
  powered = false
  rate = 0
  /** accumulated platter rotation in radians, read by the scene every frame */
  platterAngle = 0
  private targetRate = 0
  private speedFactor = 1
  private volume = 0.7
  /** progress (0..1) across the whole album, kept valid while needle is up too */
  private restProgress = 0

  get ready() {
    return this.ctx !== null
  }

  init() {
    if (this.ctx) return
    const ctx = new AudioContext()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = 1
    this.master.connect(ctx.destination)

    // music chain: el -> lowshelf warmth -> highshelf rolloff -> gain -> master
    const low = ctx.createBiquadFilter()
    low.type = 'lowshelf'
    low.frequency.value = 220
    low.gain.value = 1.5
    const high = ctx.createBiquadFilter()
    high.type = 'highshelf'
    high.frequency.value = 7500
    high.gain.value = -2.5
    this.musicGain = ctx.createGain()
    this.musicGain.gain.value = this.volume
    low.connect(high)
    high.connect(this.musicGain)
    this.musicGain.connect(this.master)
    this.musicIn = low

    this.sfx = buildSfx(ctx)

    this.crackleGain = ctx.createGain()
    this.crackleGain.gain.value = 0
    this.crackleGain.connect(this.master)
    this.crackleSrc = ctx.createBufferSource()
    this.crackleSrc.buffer = this.sfx.crackleLoop
    this.crackleSrc.loop = true
    this.crackleSrc.connect(this.crackleGain)
    this.crackleSrc.start()

    this.humGain = ctx.createGain()
    this.humGain.gain.value = 0
    this.humGain.connect(this.master)
    const hum = ctx.createBufferSource()
    hum.buffer = this.sfx.humLoop
    hum.loop = true
    hum.connect(this.humGain)
    hum.start()

    const el = new Audio()
    el.preload = 'auto'
    el.preservesPitch = false // authentic pitch bend during spin-up/down
    el.onended = () => this.onTrackEnded()
    ctx.createMediaElementSource(el).connect(this.musicIn)
    this.el = el
  }

  playSfx(name: SfxName, volume = 1, rate = 1) {
    if (!this.ctx) return
    const src = this.ctx.createBufferSource()
    src.buffer = this.sfx[name]
    src.playbackRate.value = rate
    const g = this.ctx.createGain()
    g.gain.value = volume
    src.connect(g)
    g.connect(this.master)
    src.start()
  }

  loadAlbum(album: Album | null) {
    this.stopMusic()
    this.album = album
    this.trackIndex = -1
    this.restProgress = 0
    this.durations = album ? album.tracks.map((t) => (t.durationMs || 240000) / 1000) : []
  }

  totalDuration() {
    return this.durations.reduce((a, b) => a + b, 0)
  }

  /** drop the stylus at progress p (0..1 across the album) */
  dropNeedle(p: number) {
    if (!this.ctx) return
    this.needleDown = true
    this.restProgress = p
    this.playSfx('needleDrop', 0.8)
    this.rampGain(this.crackleGain, this.crackleLevel(), 0.15)
    clearTimeout(this.dropTimer)
    this.dropTimer = setTimeout(() => this.startMusicAt(p), 550)
  }

  liftNeedle(silent = false) {
    if (!this.needleDown) return
    this.restProgress = this.getProgress()
    this.needleDown = false
    clearTimeout(this.dropTimer)
    this.clearMetaHandler()
    if (!silent) this.playSfx('needleLift', 0.6)
    if (this.ctx) this.rampGain(this.crackleGain, 0, 0.2)
    this.el?.pause()
    useStore.getState().setNowPlayingTrack(-1)
  }

  private startMusicAt(p: number) {
    if (!this.album || !this.el || this.album.tracks.length === 0 || !this.needleDown) return
    const total = this.totalDuration()
    let target = p * total
    let i = 0
    while (i < this.durations.length - 1 && target > this.durations[i]) {
      target -= this.durations[i]
      i++
    }
    this.playTrack(i, target)
  }

  private playTrack(i: number, offset: number) {
    if (!this.album || !this.el) return
    const el = this.el
    this.clearMetaHandler()
    this.trackIndex = i
    el.src = trackUrl(this.album, i)
    // seek only once metadata is in: seeking a fresh element is unreliable, and
    // manifest durations (iTunes) can exceed the actual audio we downloaded
    const onMeta = () => {
      this.metaHandler = null
      if (!this.needleDown) return
      if (Number.isFinite(el.duration) && el.duration > 0) {
        this.durations[i] = el.duration
        el.currentTime = Math.min(Math.max(offset, 0), Math.max(0, el.duration - 0.75))
      }
      void el.play().catch(() => {})
    }
    this.metaHandler = onMeta
    el.addEventListener('loadedmetadata', onMeta, { once: true })
    el.load()
    useStore.getState().setNowPlayingTrack(i)
  }

  private clearMetaHandler() {
    if (this.metaHandler && this.el) {
      this.el.removeEventListener('loadedmetadata', this.metaHandler)
      this.metaHandler = null
    }
  }

  private onTrackEnded() {
    if (!this.album || !this.needleDown) return
    if (this.trackIndex < this.album.tracks.length - 1) {
      // brief groove-gap of pure crackle between tracks
      setTimeout(() => {
        if (this.needleDown) this.playTrack(this.trackIndex + 1, 0)
      }, 1400)
    } else {
      // run-out groove: auto lift
      this.restProgress = 1
      this.liftNeedle()
      useStore.getState().setNeedle('rest')
    }
  }

  private stopMusic() {
    clearTimeout(this.dropTimer)
    this.clearMetaHandler()
    this.needleDown = false
    this.el?.pause()
    if (this.ctx) this.rampGain(this.crackleGain, 0, 0.1)
  }

  setPower(on: boolean) {
    this.powered = on
    this.targetRate = on ? this.speedFactor : 0
    this.playSfx(on ? 'switchOn' : 'switchOff', 0.7)
    if (this.ctx) this.rampGain(this.humGain, on ? 0.05 : 0, on ? 0.5 : 1.2)
  }

  setSpeed(s: 33 | 45) {
    this.speedFactor = s === 45 ? 45 / (100 / 3) : 1
    if (this.powered) this.targetRate = this.speedFactor
  }

  setVolume(v: number) {
    this.volume = v
    if (this.ctx) this.rampGain(this.musicGain, v * v, 0.05) // perceptual-ish curve
  }

  /** progress across the album right now (drives the tonearm) */
  getProgress(): number {
    if (!this.album || this.album.tracks.length === 0) return this.restProgress
    if (!this.needleDown || this.trackIndex < 0 || !this.el) return this.restProgress
    let base = 0
    for (let i = 0; i < this.trackIndex; i++) base += this.durations[i]
    const total = this.totalDuration()
    return total > 0 ? Math.min(1, (base + this.el.currentTime) / total) : 0
  }

  /** called every frame from the render loop */
  update(dt: number) {
    if (!this.ctx) return
    // platter inertia
    const accel = this.targetRate > this.rate ? SPIN_UP_RATE : SPIN_DOWN_RATE
    const delta = this.targetRate - this.rate
    const step = accel * dt
    this.rate = Math.abs(delta) <= step ? this.targetRate : this.rate + Math.sign(delta) * step
    this.platterAngle -= this.rate * 3.4907 * dt // 33.33 rpm clockwise

    if (this.el && this.needleDown) {
      if (this.rate >= MIN_AUDIBLE_RATE) {
        this.el.playbackRate = Math.max(0.25, Math.min(2, this.rate))
        if (this.el.paused && this.el.src && this.powered) void this.el.play().catch(() => {})
      } else if (!this.el.paused) {
        this.el.pause()
      }
      // crackle follows the groove speed
      this.crackleSrc.playbackRate.value = Math.max(0.05, this.rate)
      const target = this.rate > 0.05 ? this.crackleLevel() * this.rate : 0
      this.crackleGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1)
    }
  }

  private crackleLevel() {
    return 0.5
  }

  private rampGain(node: GainNode, value: number, seconds: number) {
    if (!this.ctx) return
    node.gain.cancelScheduledValues(this.ctx.currentTime)
    node.gain.setTargetAtTime(value, this.ctx.currentTime, seconds / 3)
  }
}

export const engine = new AudioEngine()

if (import.meta.env.DEV) {
  ;(window as unknown as { __engine: AudioEngine }).__engine = engine
}
