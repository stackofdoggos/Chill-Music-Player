import { create } from 'zustand'

type BootState = {
  albumProgress: number
  sceneProgress: number
  albumsReady: boolean
  sceneReady: boolean
  setAlbums: (progress: number) => void
  setScene: (progress: number, ready: boolean) => void
}

export const useBoot = create<BootState>((set) => ({
  albumProgress: 0,
  sceneProgress: 0,
  albumsReady: false,
  sceneReady: false,
  setAlbums: (progress) =>
    set({ albumProgress: progress, albumsReady: progress >= 1 }),
  setScene: (progress, ready) => set({ sceneProgress: progress, sceneReady: ready }),
}))

/** Albums decoded and the room's GLB + textures in the loader cache. */
export function waitForAssets(): Promise<void> {
  const done = (s: BootState) => s.albumsReady && s.sceneReady
  if (done(useBoot.getState())) return Promise.resolve()
  return new Promise((resolve) => {
    const unsub = useBoot.subscribe((s) => {
      if (!done(s)) return
      unsub()
      resolve()
    })
  })
}
