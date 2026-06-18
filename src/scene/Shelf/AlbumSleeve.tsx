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
import { SLEEVE, SLEEVE_OUT_POS, SLEEVE_OUT_ROT_Y, sleeveSlot } from '../layout'

const FLIP_DRAG_PX = 180

export function AlbumSleeve({ album, index }: { album: Album; index: number }) {
  const outer = useRef<THREE.Group>(null)
  const pose = useRef<THREE.Group>(null)
  const hinge = useRef<THREE.Group>(null)
  const slot = useMemo(() => sleeveSlot(index), [index])
  const [hover, setHover] = useState(false)
  const selected = useStore((s) => s.selectedAlbumId === album.id)
  const phase = useStore((s) => s.recordPhase)
  const sleeveSide = useStore((s) => s.sleeveSide)
  const draggingSleeve = useStore((s) => s.draggingSleeve)
  const flip = useRef(0)
  const moved = useRef(false)
  const canFlip = selected && phase === 'out'
  useCursor(hover && canFlip, canFlip && draggingSleeve ? 'grabbing' : 'grab')

  const materials = useMemo(() => {
    const t = sleeveTextures(album)
    const std = (map: THREE.Texture) => new THREE.MeshStandardMaterial({ map, roughness: 0.65 })
    // box faces: +x front cover, -x back, +y/-y edges, +z spine, -z open edge
    return [std(t.front), std(t.back), t.edge, t.edge, std(t.spine), t.edge]
  }, [album])

  const isOut = selected && (phase === 'pullingOut' || phase === 'out' || phase === 'returning')

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
    if (s.view !== 'shelf' && !isOut) {
      s.setView('shelf')
      if (s.view === 'overview') return // first click just walks over
    }
    if (selected && s.recordPhase === 'out') {
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
    if (isOut) {
      easing.damp3(outer.current.position, SLEEVE_OUT_POS, 0.28, dt)
      pose.current.rotation.y = SLEEVE_OUT_ROT_Y
    } else {
      easing.damp3(
        outer.current.position,
        [slot.x, slot.y, slot.z + (hover && !selected ? 0.028 : 0)],
        0.22,
        dt,
      )
      pose.current.rotation.y = 0
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
            }}
            onPointerOut={() => setHover(false)}
          >
            <boxGeometry args={[SLEEVE.thickness, SLEEVE.size, SLEEVE.size]} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
