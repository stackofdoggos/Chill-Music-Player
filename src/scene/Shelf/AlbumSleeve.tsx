import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { easing } from 'maath'
import type { Album } from '../../albums'
import { markSleeveDragEnd, sleeveDragActiveOrRecent, useStore } from '../../state/store'
import { engine } from '../../audio/engine'
import { sleeveTextures } from '../textures'
import { SLEEVE, SLEEVE_OUT_POS, SLEEVE_OUT_ROT_Y, sleeveSlot } from '../layout'

const tmpRot = new THREE.Euler()
const FRONT_Y = SLEEVE_OUT_ROT_Y
const BACK_Y = SLEEVE_OUT_ROT_Y + Math.PI
const FLIP_DRAG_PX = 120

export function AlbumSleeve({ album, index }: { album: Album; index: number }) {
  const group = useRef<THREE.Group>(null)
  const slot = useMemo(() => sleeveSlot(index), [index])
  const [hover, setHover] = useState(false)
  const [flip, setFlip] = useState(0)
  const flipRef = useRef(0)
  const dragRef = useRef<{ startX: number; startFlip: number } | null>(null)

  const selected = useStore((s) => s.selectedAlbumId === album.id)
  const platterId = useStore((s) => s.platterAlbumId)
  const phase = useStore((s) => s.recordPhase)
  const isBrowsing = selected && (phase === 'pullingOut' || phase === 'out' || phase === 'returning')
  const vinylGone = platterId === album.id && (phase === 'onPlatter' || phase === 'toPlatter')
  const isOut = isBrowsing

  useCursor(hover && (isOut || phase === 'none' || phase === 'onPlatter'))

  const materials = useMemo(() => {
    const t = sleeveTextures(album)
    const std = (map: THREE.Texture) => new THREE.MeshStandardMaterial({ map, roughness: 0.65 })
    return [std(t.front), std(t.back), t.edge, t.edge, std(t.spine), t.edge]
  }, [album])

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (sleeveDragActiveOrRecent()) return
    const s = useStore.getState()
    if (s.view !== 'shelf' && !isOut) {
      s.setView('shelf')
      if (s.view === 'overview') return
    }
    if (selected && s.recordPhase === 'out') {
      if (vinylGone) {
        s.setHint('The record is on the turntable')
        return
      }
      s.placeRecord()
      return
    }
    const before = s.selectedAlbumId
    s.selectAlbum(album.id)
    if (useStore.getState().selectedAlbumId === album.id && before !== album.id) {
      engine.playSfx('sleeveOut', 0.85, 0.95 + Math.random() * 0.1)
      if (before) engine.playSfx('sleeveIn', 0.4, 1.1)
    }
  }

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!isOut) return
    e.stopPropagation()
    dragRef.current = { startX: e.clientX, startFlip: flipRef.current }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragRef.current) return
    e.stopPropagation()
    const delta = (e.clientX - dragRef.current.startX) / FLIP_DRAG_PX
    const f = THREE.MathUtils.clamp(dragRef.current.startFlip + delta, 0, 1)
    flipRef.current = f
    setFlip(f)
  }

  const endFlipDrag = (e: ThreeEvent<PointerEvent>) => {
    if (!dragRef.current) return
    e.stopPropagation()
    dragRef.current = null
    const snapped = flipRef.current >= 0.5 ? 1 : 0
    flipRef.current = snapped
    setFlip(snapped)
    markSleeveDragEnd()
    try {
      ;(e.target as Element).releasePointerCapture?.(e.pointerId)
    } catch {
      /* synthetic events */
    }
  }

  useFrame((_, dt) => {
    if (!group.current) return
    if (isOut) {
      easing.damp3(group.current.position, SLEEVE_OUT_POS, 0.28, dt)
      const rotY = THREE.MathUtils.lerp(FRONT_Y, BACK_Y, flip)
      tmpRot.set(0, rotY, 0)
    } else {
      if (flipRef.current !== 0) {
        flipRef.current = 0
        setFlip(0)
      }
      easing.damp3(
        group.current.position,
        [slot.x, slot.y, slot.z + (hover && !selected ? 0.028 : 0)],
        0.22,
        dt,
      )
      tmpRot.set(0, 0, 0)
    }
    easing.dampE(group.current.rotation, tmpRot, 0.28, dt)
  })

  if (vinylGone && !isBrowsing) return null

  return (
    <group ref={group} position={slot.toArray()}>
      <mesh
        material={materials}
        castShadow
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endFlipDrag}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
        }}
        onPointerOut={() => setHover(false)}
      >
        <boxGeometry args={[SLEEVE.thickness, SLEEVE.size, SLEEVE.size]} />
      </mesh>
    </group>
  )
}
