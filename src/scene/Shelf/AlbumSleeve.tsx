import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { easing } from 'maath'
import type { Album } from '../../albums'
import { useStore } from '../../state/store'
import { engine } from '../../audio/engine'
import { sleeveTextures } from '../textures'
import { SLEEVE, SLEEVE_OUT_POS, SLEEVE_OUT_ROT_Y, sleeveSlot } from '../layout'

const tmpRot = new THREE.Euler()

export function AlbumSleeve({ album, index }: { album: Album; index: number }) {
  const group = useRef<THREE.Group>(null)
  const slot = useMemo(() => sleeveSlot(index), [index])
  const [hover, setHover] = useState(false)
  const selected = useStore((s) => s.selectedAlbumId === album.id)
  const phase = useStore((s) => s.recordPhase)
  useCursor(hover)

  const materials = useMemo(() => {
    const t = sleeveTextures(album)
    const std = (map: THREE.Texture) => new THREE.MeshStandardMaterial({ map, roughness: 0.65 })
    // box faces: +x front cover, -x back, +y/-y edges, +z spine, -z open edge
    return [std(t.front), std(t.back), t.edge, t.edge, std(t.spine), t.edge]
  }, [album])

  const isOut = selected && (phase === 'pullingOut' || phase === 'out' || phase === 'returning')

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
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

  useFrame((_, dt) => {
    if (!group.current) return
    if (isOut) {
      easing.damp3(group.current.position, SLEEVE_OUT_POS, 0.28, dt)
      tmpRot.set(0, SLEEVE_OUT_ROT_Y, 0)
    } else {
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

  return (
    <group ref={group} position={slot.toArray()}>
      <mesh
        material={materials}
        castShadow
        onClick={onClick}
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
