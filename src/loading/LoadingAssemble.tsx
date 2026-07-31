import { useState } from 'react'
import { assetUrl } from '../assetUrl'
import {
  readAssembleVariant,
  writeAssembleVariant,
  type AssembleVariant,
} from './assembleConfig'
import { studioTheme } from './studioTheme'
import { EnterBubble } from './EnterBubble'

interface Props {
  ready: boolean
  entered: boolean
  onEnter: () => void
  onDissolved?: () => void
}

const VIDEOS: Record<AssembleVariant, string> = {
  player: assetUrl('loading/assemble_player.mp4'),
  sleeve: assetUrl('loading/assemble_sleeve.mp4'),
}

/** Blender-rendered Yandhi assemble clips + iMessage Enter bubble. */
export function LoadingAssemble({ ready, entered, onEnter, onDissolved }: Props) {
  const [variant, setVariant] = useState<AssembleVariant>(() => readAssembleVariant())

  const pick = (v: AssembleVariant) => {
    writeAssembleVariant(v)
    setVariant(v)
  }

  return (
    <div
      className={`loading loading--assemble${entered ? ' loading--hidden' : ''}`}
      style={{ background: studioTheme.background }}
      onTransitionEnd={(e) => {
        if (entered && e.propertyName === 'opacity') onDissolved?.()
      }}
    >
      <video
        key={variant}
        className="loading__video"
        src={VIDEOS[variant]}
        autoPlay
        muted
        playsInline
        loop
        preload="auto"
      />

      <div className="loading__variant" role="tablist" aria-label="Assemble preview">
        <button
          type="button"
          role="tab"
          aria-selected={variant === 'player'}
          className={variant === 'player' ? 'is-active' : undefined}
          onClick={() => pick('player')}
        >
          Player
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={variant === 'sleeve'}
          className={variant === 'sleeve' ? 'is-active' : undefined}
          onClick={() => pick('sleeve')}
        >
          Sleeve
        </button>
      </div>

      <EnterBubble ready={ready} onEnter={onEnter} />
    </div>
  )
}
