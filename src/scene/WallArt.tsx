import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { DESK, PLAYER_POS, ROOM } from './layout'

const BACK_WALL_Z = ROOM.backZ + 0.012
const FRAME = { wood: '#3d362e', mat: '#ebe7e0', border: 0.02, matPad: 0.03, depth: 0.02 }

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
      <mesh position={[0, 0, -FRAME.depth / 2]} castShadow>
        <boxGeometry args={[outerW, outerH, FRAME.depth]} />
        <meshStandardMaterial color={FRAME.wood} roughness={0.84} metalness={0.03} />
      </mesh>
      <mesh position={[0, 0, 0.001]}>
        <boxGeometry args={[artW + FRAME.matPad * 2, artH + FRAME.matPad * 2, 0.002]} />
        <meshStandardMaterial color={FRAME.mat} roughness={0.96} />
      </mesh>
      <mesh position={[0, 0, 0.0035]}>
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
      position={[PLAYER_POS.x, DESK.topY + 0.86, BACK_WALL_Z]}
      width={0.96}
    />
  )
}
