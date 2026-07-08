import { useMemo } from 'react'
import { RoundedBox, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { assetUrl } from '../assetUrl'
import { DESK } from './layout'

const TOP_THICK = 0.05
const BEVEL = 0.012

export function DeskTop() {
  const [diff, nor, rough] = useTexture([
    assetUrl('textures/walnut_diff.jpg'),
    assetUrl('textures/walnut_nor.jpg'),
    assetUrl('textures/walnut_rough.jpg'),
  ])

  const maps = useMemo(() => {
    diff.colorSpace = THREE.SRGBColorSpace
    for (const t of [diff, nor, rough]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.anisotropy = 4
    }
    // ~1.2 repeats per meter — matches desk footprint (1.7 × 0.62 m)
    const rx = DESK.w * 1.2
    const ry = DESK.d * 1.2
    diff.repeat.set(rx, ry)
    nor.repeat.set(rx, ry)
    rough.repeat.set(rx, ry)
    return { map: diff, normalMap: nor, roughnessMap: rough }
  }, [diff, nor, rough])

  return (
    <RoundedBox
      args={[DESK.w, TOP_THICK, DESK.d]}
      radius={BEVEL}
      smoothness={4}
      position={[DESK.x, DESK.topY - TOP_THICK / 2, DESK.z]}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        {...maps}
        metalness={0}
        roughness={1}
        normalScale={new THREE.Vector2(0.65, 0.65)}
      />
    </RoundedBox>
  )
}
