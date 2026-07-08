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
