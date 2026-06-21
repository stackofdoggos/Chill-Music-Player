import { assetUrl } from './assetUrl'

export interface Track {
  file: string
  name: string
  durationMs: number
}

export interface Album {
  id: string
  artist: string
  title: string
  year: string
  accent: string
  cover: string | null
  tracks: Track[]
  /** preloaded cover image, null when no artwork (placeholder albums) */
  coverImg: HTMLImageElement | null
}

/** Shown until `npm run fetch-albums` has produced real albums. */
const PLACEHOLDERS: Omit<Album, 'coverImg'>[] = [
  { id: 'p1', artist: 'Untitled', title: 'Album One', year: '1961', accent: '#b3202c', cover: null, tracks: [] },
  { id: 'p2', artist: 'Untitled', title: 'Album Two', year: '1968', accent: '#1e3a5f', cover: null, tracks: [] },
  { id: 'p3', artist: 'Untitled', title: 'Album Three', year: '1972', accent: '#c8b89a', cover: null, tracks: [] },
  { id: 'p4', artist: 'Untitled', title: 'Album Four', year: '1977', accent: '#e0552c', cover: null, tracks: [] },
  { id: 'p5', artist: 'Untitled', title: 'Album Five', year: '1983', accent: '#3d3a35', cover: null, tracks: [] },
  { id: 'p6', artist: 'Untitled', title: 'Album Six', year: '1990', accent: '#d4a017', cover: null, tracks: [] },
  { id: 'p7', artist: 'Untitled', title: 'Album Seven', year: '1995', accent: '#4a7c59', cover: null, tracks: [] },
]

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

export async function loadAlbums(onProgress: (done: number, total: number) => void): Promise<Album[]> {
  let raw: Omit<Album, 'coverImg'>[]
  try {
    const res = await fetch(assetUrl('albums/manifest.json'), { cache: 'no-store' })
    const json = await res.json()
    raw = json.albums?.length ? json.albums : PLACEHOLDERS
  } catch {
    raw = PLACEHOLDERS
  }
  let done = 0
  onProgress(0, raw.length)
  return Promise.all(
    raw.map(async (a) => {
      const coverImg = a.cover ? await loadImage(assetUrl(a.cover)) : null
      onProgress(++done, raw.length)
      return { ...a, coverImg }
    }),
  )
}

export function trackUrl(album: Album, index: number): string {
  return assetUrl(`albums/${album.id}/${album.tracks[index].file}`)
}
