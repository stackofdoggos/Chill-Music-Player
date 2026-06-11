/**
 * Downloads the album library: track lists + artwork from the iTunes Search
 * API, audio from YouTube via yt-dlp. Writes public/albums/manifest.json
 * incrementally so the app can use whatever has finished so far.
 *
 * Usage: node scripts/fetch-albums.mjs
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT = join(process.cwd(), 'public', 'albums')
const MANIFEST = join(OUT, 'manifest.json')

const ALBUMS = [
  { id: 'mbdtf', artist: 'Kanye West', title: 'My Beautiful Dark Twisted Fantasy', accent: '#b3202c' },
  { id: 'kind-of-blue', artist: 'Miles Davis', title: 'Kind of Blue', accent: '#1e3a5f' },
  { id: 'moon-safari', artist: 'Air', title: 'Moon Safari', accent: '#c8b89a' },
  { id: 'dive', artist: 'Tycho', title: 'Dive', accent: '#e0552c' },
  { id: 'black-sands', artist: 'Bonobo', title: 'Black Sands', accent: '#3d3a35' },
  { id: 'con-todo-el-mundo', artist: 'Khruangbin', title: 'Con Todo El Mundo', accent: '#d4a017' },
  { id: 'salad-days', artist: 'Mac DeMarco', title: 'Salad Days', accent: '#4a7c59' },
]

async function itunes(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`iTunes ${res.status} for ${url}`)
  return res.json()
}

async function findAlbum({ artist, title }) {
  const q = encodeURIComponent(`${artist} ${title}`)
  const data = await itunes(`https://itunes.apple.com/search?term=${q}&entity=album&limit=5`)
  const hit = data.results.find(
    (r) => r.collectionName.toLowerCase().startsWith(title.toLowerCase().slice(0, 8)),
  ) ?? data.results[0]
  if (!hit) throw new Error(`No iTunes album for ${artist} - ${title}`)
  return hit
}

async function getTracks(collectionId) {
  const data = await itunes(`https://itunes.apple.com/lookup?id=${collectionId}&entity=song&limit=200`)
  return data.results
    .filter((r) => r.wrapperType === 'track')
    .sort((a, b) => a.trackNumber - b.trackNumber)
    .map((t) => ({ name: t.trackName, durationMs: t.trackTimeMillis }))
}

async function downloadArt(hit, dir) {
  const dest = join(dir, 'cover.jpg')
  if (existsSync(dest)) return
  const url = hit.artworkUrl100.replace('100x100', '1000x1000')
  const res = await fetch(url)
  if (!res.ok) throw new Error(`art ${res.status}`)
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
}

function downloadTrack(artist, trackName, dest) {
  if (existsSync(dest)) return true
  const query = `${artist} ${trackName} official audio`
  const r = spawnSync(
    'yt-dlp',
    [
      '-f', 'bestaudio/best',
      '-x', '--audio-format', 'm4a', '--audio-quality', '128K',
      '--js-runtimes', 'node', '--no-update',
      '--no-playlist', '--match-filter', 'duration < 1200',
      '-o', dest.replace(/\.m4a$/, '.%(ext)s'),
      `ytsearch1:${query}`,
    ],
    { stdio: ['ignore', 'inherit', 'inherit'], timeout: 300_000 },
  )
  return r.status === 0 && existsSync(dest)
}

function readManifest() {
  try {
    return JSON.parse(readFileSync(MANIFEST, 'utf8'))
  } catch {
    return { albums: [] }
  }
}

function writeManifest(manifest) {
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2))
}

mkdirSync(OUT, { recursive: true })

for (const album of ALBUMS) {
  console.log(`\n=== ${album.artist} — ${album.title} ===`)
  const dir = join(OUT, album.id)
  mkdirSync(dir, { recursive: true })

  let hit, tracks
  try {
    hit = await findAlbum(album)
    tracks = await getTracks(hit.collectionId)
    await downloadArt(hit, dir)
  } catch (e) {
    console.error(`metadata failed for ${album.id}:`, e.message)
    continue
  }

  const done = []
  for (let i = 0; i < tracks.length; i++) {
    const n = String(i + 1).padStart(2, '0')
    const dest = join(dir, `${n}.m4a`)
    console.log(`  [${n}/${tracks.length}] ${tracks[i].name}`)
    if (downloadTrack(album.artist, tracks[i].name, dest)) {
      let durationMs = tracks[i].durationMs
      if (!durationMs) {
        const probe = spawnSync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', dest])
        durationMs = Math.round(parseFloat(probe.stdout?.toString() ?? '0') * 1000) || 240000
      }
      done.push({ file: `${n}.m4a`, name: tracks[i].name, durationMs })
    } else {
      console.error(`  FAILED: ${tracks[i].name}`)
    }
  }

  if (done.length === 0) continue
  const manifest = readManifest()
  manifest.albums = manifest.albums.filter((a) => a.id !== album.id)
  manifest.albums.push({
    id: album.id,
    artist: album.artist,
    title: album.title,
    year: (hit.releaseDate ?? '').slice(0, 4),
    accent: album.accent,
    cover: `/albums/${album.id}/cover.jpg`,
    tracks: done,
  })
  // Keep shelf order stable regardless of download completion order
  manifest.albums.sort(
    (a, b) => ALBUMS.findIndex((x) => x.id === a.id) - ALBUMS.findIndex((x) => x.id === b.id),
  )
  writeManifest(manifest)
  console.log(`  manifest updated (${done.length}/${tracks.length} tracks)`)
}

console.log('\nAll done.')
