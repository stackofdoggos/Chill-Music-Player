import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { easing } from 'maath'
import type { Album } from '../../albums'
import { dragActiveOrRecent, markDragEnd, useStore } from '../../state/store'
import { engine } from '../../audio/engine'
import { sleeveTextures } from '../textures'
import {
  BASKET,
  DISPLAY_SLOTS,
  SHELF_FRONT_Z,
  SLEEVE,
  SLEEVE_LEAN,
  SLEEVE_OUT_POS,
  SLEEVE_OUT_ROT_Y,
  SLEEVE_SHELF_ROT_Y,
  basketIndexFor,
  sleeveSlot,
} from '../layout'

const FLIP_DRAG_PX = 180
/** lean of a record standing loosely in a wicker bin */
const BASKET_LEAN = 0.06

export function AlbumSleeve({ album, index }: { album: Album; index: number }) {
  const outer = useRef<THREE.Group>(null)
  const pose = useRef<THREE.Group>(null)
  const hinge = useRef<THREE.Group>(null)
  const slot = useMemo(() => sleeveSlot(index), [index])
  const inBasket = index >= DISPLAY_SLOTS
  const myBasket = inBasket ? basketIndexFor(index) : -1
  const basketIsOut = useStore((s) => s.basketOut === myBasket)
  const [hover, setHover] = useState(false)
  const selected = useStore((s) => s.selectedAlbumId === album.id)
  const shelfPhase = useStore((s) => s.shelfPhase)
  const sleeveSide = useStore((s) => s.sleeveSide)
  const draggingSleeve = useStore((s) => s.draggingSleeve)
  const flip = useRef(0)
  const moved = useRef(false)
  const canFlip = selected && shelfPhase === 'out'
  useCursor(hover && canFlip, canFlip && draggingSleeve ? 'grabbing' : 'grab')

  const materials = useMemo(() => {
    const t = sleeveTextures(album)
    const std = (map: THREE.Texture) => new THREE.MeshStandardMaterial({ map, roughness: 0.65 })
    // box faces: +x front cover, -x back, +y/-y edges, +z spine, -z open edge
    return [std(t.front), std(t.back), t.edge, t.edge, std(t.spine), t.edge]
  }, [album])

  const isOut = selected && (shelfPhase === 'pullingOut' || shelfPhase === 'out')

  useEffect(() => {
    if (!canFlip) flip.current = 0
  }, [canFlip])

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (moved.current) {
      moved.current = false
      return
    }
    if (dragActiveOrRecent()) return
    const s = useStore.getState()
    if (s.view !== 'shelf' && !isOut) s.setView('shelf')
    if (selected && s.shelfPhase === 'out') {
      s.placeRecord()
      return
    }
    const before = s.selectedAlbumId
    s.selectAlbum(album.id)
    if (useStore.getState().selectedAlbumId === album.id && before !== album.id) {
      engine.playSfx('sleeveOut', 0.85, 0.95 + Math.random() * 0.1)
      if (before) engine.playSfx('sleeveIn', 0.85, 1.05)
    }
  }

  const onFlipDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    moved.current = false
    const startX = e.clientX
    const startFlip = flip.current
    let dragging = false

    const onMove = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - startX) <= 4) return
      if (!dragging) {
        dragging = true
        moved.current = true
        useStore.getState().setDraggingSleeve(true)
        try {
          ;(e.target as Element).setPointerCapture(ev.pointerId)
        } catch {
          /* synthetic pointers can't always be captured */
        }
      }
      flip.current = THREE.MathUtils.clamp(
        startFlip + ((ev.clientX - startX) / FLIP_DRAG_PX) * Math.PI,
        0,
        Math.PI,
      )
    }

    const onUp = (ev: PointerEvent) => {
      if (dragging) {
        try {
          ;(e.target as Element).releasePointerCapture(ev.pointerId)
        } catch {
          /* capture may already be gone */
        }
        markDragEnd()
        useStore.getState().setDraggingSleeve(false)
        const back = flip.current > Math.PI / 2
        useStore.getState().setSleeveSide(back ? 'back' : 'front')
        flip.current = back ? Math.PI : 0
      }
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp, true)
      window.removeEventListener('pointercancel', onUp, true)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, true)
    window.addEventListener('pointercancel', onUp, true)
  }

  useFrame((_, dt) => {
    if (!outer.current || !pose.current || !hinge.current) return
    const p = outer.current.position
    // bin albums track their bin as it slides open/closed
    const homeZ = slot.z + (inBasket && basketIsOut ? BASKET.outDz : 0)
    if (isOut) {
      // clear the bookcase first (ride the bin out / slide out of the
      // compartment), then glide to the inspection pose
      const cleared = p.z > SHELF_FRONT_Z + (inBasket ? 0.08 : 0.05)
      const staging: [number, number, number] = inBasket
        ? [slot.x, slot.y, slot.z + BASKET.outDz]
        : [slot.x, slot.y, SLEEVE_OUT_POS.z]
      easing.damp3(p, cleared ? SLEEVE_OUT_POS : staging, 0.28, dt)
      pose.current.rotation.y = SLEEVE_OUT_ROT_Y
      easing.damp(pose.current.rotation, 'x', 0, 0.22, dt)
    } else if (inBasket) {
      if (p.y > slot.y + 0.15) {
        // returning from inspection: hover above the open bin, then drop in
        const alignedXZ =
          Math.abs(p.x - slot.x) < 0.03 && Math.abs(p.z - homeZ) < 0.03
        easing.damp3(
          p,
          alignedXZ ? [slot.x, slot.y, homeZ] : [slot.x, BASKET.riseY, homeZ],
          0.24,
          dt,
        )
      } else {
        easing.damp3(
          p,
          [slot.x, slot.y + (hover && !selected ? 0.02 : 0), homeZ],
          0.22,
          dt,
        )
      }
      pose.current.rotation.y = SLEEVE_SHELF_ROT_Y
      easing.damp(pose.current.rotation, 'x', -BASKET_LEAN, 0.22, dt)
    } else {
      // returning: line up with the slot while still in front, then slide in
      const aligned =
        Math.abs(p.x - slot.x) < 0.02 && Math.abs(p.y - slot.y) < 0.02
      easing.damp3(
        p,
        [
          slot.x,
          slot.y,
          aligned
            ? slot.z + (hover && !selected ? 0.028 : 0)
            : SLEEVE_OUT_POS.z,
        ],
        0.22,
        dt,
      )
      pose.current.rotation.y = SLEEVE_SHELF_ROT_Y
      easing.damp(pose.current.rotation, 'x', -SLEEVE_LEAN, 0.22, dt)
    }

    const goal = canFlip ? (sleeveSide === 'back' ? Math.PI : 0) : 0
    const liveDrag = canFlip && draggingSleeve
    if (!liveDrag) easing.damp(flip, 'current', goal, 0.22, dt)
    hinge.current.rotation.y = flip.current
  })

  return (
    <group ref={outer} position={slot.toArray()}>
      <group ref={pose}>
        <group ref={hinge}>
          <mesh
            material={materials}
            castShadow
            onClick={onClick}
            onPointerDown={canFlip ? onFlipDown : undefined}
            onPointerOver={(e) => {
              e.stopPropagation()
              setHover(true)
              useStore.getState().setHoveredAlbumId(album.id)
            }}
            onPointerOut={() => {
              setHover(false)
              const s = useStore.getState()
              if (s.hoveredAlbumId === album.id) s.setHoveredAlbumId(null)
            }}
          >
            <boxGeometry args={[SLEEVE.thickness, SLEEVE.size, SLEEVE.size]} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
