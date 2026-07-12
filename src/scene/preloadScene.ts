import * as THREE from 'three'
import { useGLTF, useTexture } from '@react-three/drei'
import { assetUrl } from '../assetUrl'
import { useBoot } from '../state/boot'

/** GLB is Draco-compressed — decoder path must be set before preload/load. */
useGLTF.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')

export const GLB_PATH = assetUrl('models/room.glb')
export const GLB_USE_DRACO = true

const TEXTURES = [
  assetUrl('textures/walnut_diff.jpg'),
  assetUrl('textures/walnut_nor.jpg'),
  assetUrl('textures/walnut_rough.jpg'),
  assetUrl('textures/wall_diff.jpg'),
  assetUrl('textures/wall_nor.png'),
  assetUrl('textures/wall_rough.jpg'),
  assetUrl('textures/wicker_diff.jpg'),
  assetUrl('textures/wicker_nor.jpg'),
  assetUrl('textures/wicker_rough.jpg'),
  assetUrl('art/de-hooch-musical-company.jpg'),
]

let bootProgressHooked = false

function hookBootProgress() {
  if (bootProgressHooked) return
  bootProgressHooked = true
  const mgr = THREE.DefaultLoadingManager
  mgr.onProgress = (_url, loaded, total) => {
    useBoot.getState().setScene(total > 0 ? loaded / total : 0, false)
  }
  mgr.onLoad = () => useBoot.getState().setScene(1, true)
  mgr.onError = () => useBoot.getState().setScene(1, true)
}

/** Kick off drei loader cache population during boot (updates useBoot, not useProgress). */
export function preloadSceneAssets() {
  hookBootProgress()
  useGLTF.preload(GLB_PATH, GLB_USE_DRACO)
  useTexture.preload(TEXTURES)
}
