import { Suspense } from 'react'
import { WallArt } from './WallArt'

/** Room shell + desk come from SceneModel GLB; keep code-driven wall art here. */
export function Room() {
  return (
    <Suspense fallback={null}>
      <WallArt />
    </Suspense>
  )
}
