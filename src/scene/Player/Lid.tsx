import { useEffect, useState } from 'react'
import { createPortal, useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import { easing } from 'maath'
import { dragActiveOrRecent, useStore } from '../../state/store'
import { engine } from '../../audio/engine'
import { useSceneModel } from '../SceneModel'

/** Lid mesh is in room.glb under `lid_hinge`; code drives hinge rotation + click. */
export function Lid() {
  const { nodes } = useSceneModel()
  const hinge = nodes.lid_hinge
  const lidOpen = useStore((s) => s.lidOpen)
  const phase = useStore((s) => s.recordPhase)
  const [hover, setHover] = useState(false)
  useCursor(hover)

  useEffect(() => {
    if (phase === 'toPlatter' && !useStore.getState().lidOpen) {
      useStore.getState().setLid(true)
      engine.playSfx('lid', 0.7)
    }
  }, [phase])

  const toggle = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (dragActiveOrRecent()) return
    const s = useStore.getState()
    s.setLid(!s.lidOpen)
    engine.playSfx('lid', 0.7, s.lidOpen ? 0.9 : 1.05)
  }

  useFrame((_, dt) => {
    if (hinge) easing.damp(hinge.rotation, 'x', lidOpen ? -1.45 : 0, 0.4, dt)
  })

  if (!hinge) return null
  return createPortal(
    <mesh
      position={[0, 0.0525, 0.174]}
      visible={false}
      onClick={toggle}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHover(true)
      }}
      onPointerOut={() => setHover(false)}
    >
      <boxGeometry args={[0.565, 0.105, 0.348]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>,
    hinge,
  )
}
