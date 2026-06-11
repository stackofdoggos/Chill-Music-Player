import { forwardRef, useMemo } from 'react'
import * as THREE from 'three'
import type { Album } from '../../albums'
import { vinylTopTexture } from '../textures'
import { VINYL_R, VINYL_THICKNESS } from '../layout'

interface Props {
  album: Album
  onClick?: (e: { stopPropagation: () => void }) => void
  onPointerOver?: (e: { stopPropagation: () => void }) => void
  onPointerOut?: () => void
}

/** the record disc itself; cylinder axis is +y, label on top */
export const Vinyl = forwardRef<THREE.Group, Props>(function Vinyl(
  { album, onClick, onPointerOver, onPointerOut },
  ref,
) {
  const materials = useMemo(() => {
    const top = vinylTopTexture(album)
    return [
      new THREE.MeshStandardMaterial({ color: '#111113', roughness: 0.55 }),
      new THREE.MeshStandardMaterial({ map: top, roughness: 0.38, metalness: 0.08 }),
      new THREE.MeshStandardMaterial({ map: top, roughness: 0.38, metalness: 0.08 }),
    ]
  }, [album])

  return (
    <group ref={ref}>
      <mesh
        material={materials}
        castShadow
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        <cylinderGeometry args={[VINYL_R, VINYL_R, VINYL_THICKNESS, 72]} />
      </mesh>
    </group>
  )
})
