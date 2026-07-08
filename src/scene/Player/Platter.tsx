import { useFrame } from '@react-three/fiber'
import { engine } from '../../audio/engine'
import { useSceneModel } from '../SceneModel'

/** Platter visuals spin via GLB `platter_spin`; code drives rotation only. */
export function Platter() {
  const { nodes } = useSceneModel()

  useFrame(() => {
    const spin = nodes.platter_spin
    if (spin) spin.rotation.y = engine.platterAngle
  })

  return null
}
