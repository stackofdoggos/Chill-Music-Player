import { useEffect, useRef, useState } from 'react'
import { engine } from '../audio/engine'
import { waitForAssets } from '../state/boot'
import { UnmuteGate } from './UnmuteGate'
import { EnterBubble, type BubbleState } from './EnterBubble'
import {
  ASSEMBLE_DURATION,
  ASSEMBLE_SETTLES_AT,
  CLIPS,
  IRIS,
  MUSIC_VOLUME,
  SPIN_DURATION,
  SPIN_FACE_ON,
  TIMING,
  enterLabel,
  markIntroSeen,
} from './introTimeline'
import { align, atTime, fadeOut, once, sleep, waitForBuffered } from './mediaTiming'

type Phase = 'gate' | 'buffering' | 'assemble' | 'spin' | 'faceOn' | 'disassemble' | 'iris'

/** Later phases paint over earlier ones, so a clip stays visible once it's shown. */
const PHASE_ORDER: Phase[] = ['gate', 'buffering', 'assemble', 'spin', 'faceOn', 'disassemble', 'iris']

interface Props {
  /** Start rendering the room behind the still-opaque intro, to warm shaders. */
  onWarmScene: () => void
  /** Frozen on the spindle hole — open the room out of it. */
  onReveal: () => void
}

function useDeferred() {
  const ref = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null)
  if (!ref.current) {
    let resolve!: () => void
    const promise = new Promise<void>((r) => {
      resolve = r
    })
    ref.current = { promise, resolve }
  }
  return ref.current
}

/**
 * The Yandhi loading sequence, shown on a first visit and then not again for a
 * week — see `readIntroMode`. Unmute gate, buffer, 13s assemble, spin loop,
 * then on ENTER rotate to face-on, hold, and play the assemble backwards down
 * to a blank sleeve. `introTimeline.ts` has the frame math that makes the clip
 * handoffs seamless.
 */
export function YandhiIntro({ onWarmScene, onReveal }: Props) {
  const [phase, setPhase] = useState<Phase>('gate')
  const [bubble, setBubble] = useState<BubbleState>('hidden')
  const [label] = useState(enterLabel)
  /** Edge to edge for the shatter, inset once the record settles. */
  const [bleed, setBleed] = useState(true)
  // Clip sources are attached in sequence so the downloads never compete: the
  // gate covers the assemble, the assemble covers the spin, the spin covers the outro.
  const [spinSrc, setSpinSrc] = useState<string | null>(null)
  const [disSrc, setDisSrc] = useState<string | null>(null)

  const assembleRef = useRef<HTMLVideoElement>(null)
  const spinRef = useRef<HTMLVideoElement>(null)
  const disRef = useRef<HTMLVideoElement>(null)
  const musicRef = useRef<HTMLAudioElement>(null)
  const spinStart = useRef(0)

  const gate = useDeferred()
  const enter = useDeferred()
  const started = useRef(false)

  const seen = (p: Phase) => PHASE_ORDER.indexOf(phase) >= PHASE_ORDER.indexOf(p)

  useEffect(() => {
    // One-shot boot sequence, so it survives StrictMode's double invoke rather
    // than being cancelled and restarted (see AGENTS.md on StrictMode).
    if (started.current) return
    started.current = true

    const runBubbles = async (assemble: HTMLVideoElement) => {
      await atTime(assemble, TIMING.typingAt)
      setBubble('typing')
      await Promise.all([waitForAssets(), atTime(assemble, TIMING.typingAt + TIMING.typingHold)])
      setBubble('ready')
      onWarmScene()
    }

    const playOutro = async () => {
      const spin = spinRef.current
      const dis = disRef.current
      if (!spin || !dis) return

      // Rotate to the face-on frame: the one pose the disassemble can cut from.
      // On the first lap the assemble clip's own tail already supplied a full
      // revolution, so hopping the short way there is correct. After that a
      // click landing just shy of face-on would cut over almost instantly, so
      // give it another lap.
      const firstLap = performance.now() - spinStart.current < SPIN_DURATION * 1000
      let wait = (SPIN_FACE_ON - (spin.currentTime % SPIN_DURATION) + SPIN_DURATION) % SPIN_DURATION
      if (!firstLap && wait < TIMING.minSpinBeforeOutro) wait += SPIN_DURATION
      await sleep(wait * 1000)

      spin.pause()
      spin.currentTime = SPIN_FACE_ON // snap, so the cut is exact even if the timer drifted
      setPhase('faceOn')
      // Open back out during the hold, so the outro is already full bleed by the
      // time its debris reaches the frame edge 0.36s in.
      setBleed(true)
      // The hold doubles as cover if the outro clip is still downloading.
      await Promise.all([sleep(TIMING.faceOnHold * 1000), waitForBuffered([dis], TIMING.bufferTimeout)])

      setPhase('disassemble')
      dis.currentTime = 0
      dis.playbackRate = TIMING.disassembleRate
      await dis.play().catch(() => {})

      // Stop on the spindle hole rather than running to the blank sleeve — the
      // room opens out of the hole from here. See IRIS for why this must not
      // overshoot. Racing a timeout keeps a stalled clip from parking the intro
      // on a shard-covered frame: the snap lands on the hole either way.
      const budget = (IRIS.trigger / TIMING.disassembleRate) * 1000 + 4000
      await Promise.race([atTime(dis, IRIS.trigger), sleep(budget)])
      dis.pause()
      dis.currentTime = IRIS.frame
    }

    const run = async () => {
      const spin = spinRef.current
      const music = musicRef.current
      const assemble = assembleRef.current
      if (!spin || !music || !assemble) return
      await gate.promise

      // Nothing moves — no music, no bubble — until picture and music can both
      // run clean to the end. Frames 0-10 are identical, so holding on frame 0
      // is indistinguishable from the render's opening beat.
      setPhase('buffering')
      await waitForBuffered([assemble, music], TIMING.bufferTimeout)

      setPhase('assemble')
      setSpinSrc(CLIPS.spin)
      assemble.currentTime = 0
      music.currentTime = 0
      music.volume = MUSIC_VOLUME
      await Promise.allSettled([assemble.play(), music.play()])
      await sleep(120)
      align(music, assemble)
      void runBubbles(assemble)
      void atTime(assemble, ASSEMBLE_SETTLES_AT).then(() => setBleed(false))

      await once(assemble, 'ended', ASSEMBLE_DURATION * 1000 + 4000)
      setDisSrc(CLIPS.disassemble)
      // assemble[389] and spin[0] are consecutive frames of the same rotation.
      await waitForBuffered([spin], TIMING.bufferTimeout)
      setPhase('spin')
      spin.currentTime = 0
      spin.loop = true
      spinStart.current = performance.now()
      void spin.play().catch(() => {})

      await enter.promise
      setBubble('hidden')
      await playOutro()

      markIntroSeen()
      setPhase('iris')
      if (musicRef.current) fadeOut(musicRef.current, IRIS.openMs)
      onReveal() // App opens the hole and unmounts this once it has swallowed the screen
    }

    void run()
  }, [gate, enter, onWarmScene, onReveal])

  const onUnmute = () => {
    // The AudioContext is constructed inside the gesture, so it starts running.
    void engine.init().catch(() => {})
    gate.resolve()
  }

  const onEnter = () => enter.resolve()

  return (
    <div className={`intro${bleed ? ' intro--bleed' : ''}`}>
      <video
        ref={assembleRef}
        className={`intro__clip${seen('buffering') ? ' is-shown' : ''}`}
        src={CLIPS.assemble}
        muted
        playsInline
        preload="auto"
      />
      <video
        ref={spinRef}
        className={`intro__clip${seen('spin') ? ' is-shown' : ''}`}
        src={spinSrc ?? undefined}
        muted
        playsInline
        preload="auto"
      />
      <video
        ref={disRef}
        className={`intro__clip${seen('disassemble') ? ' is-shown' : ''}`}
        src={disSrc ?? undefined}
        muted
        playsInline
        preload="auto"
      />
      {/* The spin loop is open-ended, so the track just repeats if it runs out.
          It is not synced to the rotation — nothing depends on where it wraps. */}
      <audio ref={musicRef} src={CLIPS.music} loop preload="auto" />
      {phase === 'gate' && <UnmuteGate onUnmute={onUnmute} />}
      <EnterBubble state={bubble} label={label} onEnter={onEnter} />
    </div>
  )
}
