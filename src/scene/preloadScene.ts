import { useGLTF, useTexture } from '@react-three/drei'
import { assetUrl } from '../assetUrl'

/** GLB is Draco-compressed — decoder path must be set before preload/load. */
useGLTF.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')

export const GLB_PATH = assetUrl('models/room.glb')
export const GLB_USE_DRACO = true

const TEXTURES = [
  assetUrl('textures/walnut_diff.jpg'),
  assetUrl('textures/walnut_nor.jpg'),
  assetUrl('textures/walnut_rough.jpg'),
  assetUrl('textures/wicker_diff.jpg'),
  assetUrl('textures/wicker_nor.jpg'),
  assetUrl('textures/wicker_rough.jpg'),
]

/** Kick off drei/fiber loader cache population during boot. */
export function preloadSceneAssets() {
  useGLTF.preload(GLB_PATH, GLB_USE_DRACO)
  useTexture.preload(TEXTURES)
}
