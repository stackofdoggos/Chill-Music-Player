import type { ThreeEvent } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { dragActiveOrRecent, useStore } from '../state/store'
import { WALL_ART } from './layout'

const FRAME = { wood: '#3d362e', mat: '#ebe7e0', border: 0.02, matPad: 0.03, depth: 0.02 }

function focusArt(e: ThreeEvent<MouseEvent>) {
  e.stopPropagation()
  if (dragActiveOrRecent()) return
  useStore.getState().setView('art')
}

function FramedArt({
  src,
  position,
  width,
}: {
  src: string
  position: [number, number, number]
  width: number
}) {
  const tex = useTexture(src)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true

  const img = tex.image as HTMLImageElement
  const aspect = img.width / img.height
  const artW = width
  const artH = width / aspect
  const pad = FRAME.border + FRAME.matPad
  const outerW = artW + pad * 2
  const outerH = artH + pad * 2

  return (
    <group position={position}>
      <mesh position={[0, 0, -FRAME.depth / 2]} castShadow onClick={focusArt}>
        <boxGeometry args={[outerW, outerH, FRAME.depth]} />
        <meshStandardMaterial color={FRAME.wood} roughness={0.84} metalness={0.03} />
      </mesh>
      <mesh position={[0, 0, 0.001]} onClick={focusArt}>
        <boxGeometry args={[artW + FRAME.matPad * 2, artH + FRAME.matPad * 2, 0.002]} />
        <meshStandardMaterial color={FRAME.mat} roughness={0.96} />
      </mesh>
      <mesh position={[0, 0, 0.0035]} onClick={focusArt}>
        <planeGeometry args={[artW, artH]} />
        <meshStandardMaterial map={tex} roughness={0.94} metalness={0} />
      </mesh>
    </group>
  )
}

/** wide landscape art on the back wall above the record player */
export function WallArt() {
  return (
    <FramedArt
      src="/art/de-hooch-musical-company.jpg"
      position={[WALL_ART.x, WALL_ART.y, WALL_ART.z]}
      width={WALL_ART.width}
    />
  )
}
