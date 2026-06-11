import * as THREE from 'three'
import type { Album } from '../albums'

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return { canvas: c, g: c.getContext('2d')! }
}

function tex(canvas: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif"

/** vinyl disc top: grooves + paper label (cover art if available) */
export function vinylTopTexture(album: Album): THREE.CanvasTexture {
  const S = 1024
  const { canvas, g } = makeCanvas(S, S)
  const cx = S / 2
  const rOuter = S * 0.49
  const rLabel = S * 0.165
  const rGrooveIn = S * 0.19

  g.fillStyle = '#0b0b0c'
  g.beginPath()
  g.arc(cx, cx, rOuter, 0, Math.PI * 2)
  g.fill()

  // grooves: many faint rings with random sheen
  for (let r = rGrooveIn; r < rOuter - 6; r += 1.6) {
    const a = 0.025 + Math.random() * 0.05
    g.strokeStyle = `rgba(255,255,255,${a.toFixed(3)})`
    g.lineWidth = 0.7
    g.beginPath()
    g.arc(cx, cx, r, 0, Math.PI * 2)
    g.stroke()
  }
  // lead-in / outer edge
  g.strokeStyle = 'rgba(255,255,255,0.10)'
  g.lineWidth = 2
  g.beginPath()
  g.arc(cx, cx, rOuter - 3, 0, Math.PI * 2)
  g.stroke()

  // track separator bands (slightly darker, like wider groove spacing)
  const total = album.tracks.reduce((a, t) => a + (t.durationMs || 240000), 0)
  if (total > 0) {
    let acc = 0
    for (let i = 0; i < album.tracks.length - 1; i++) {
      acc += album.tracks[i].durationMs || 240000
      const p = acc / total
      const r = (rOuter - 8) - p * (rOuter - 8 - rGrooveIn)
      g.strokeStyle = 'rgba(0,0,0,0.85)'
      g.lineWidth = 3.5
      g.beginPath()
      g.arc(cx, cx, r, 0, Math.PI * 2)
      g.stroke()
    }
  }

  // label
  g.save()
  g.beginPath()
  g.arc(cx, cx, rLabel, 0, Math.PI * 2)
  g.clip()
  if (album.coverImg) {
    g.drawImage(album.coverImg, cx - rLabel, cx - rLabel, rLabel * 2, rLabel * 2)
    g.fillStyle = 'rgba(0,0,0,0.18)'
    g.fillRect(cx - rLabel, cx - rLabel, rLabel * 2, rLabel * 2)
  } else {
    g.fillStyle = album.accent
    g.fillRect(cx - rLabel, cx - rLabel, rLabel * 2, rLabel * 2)
    g.fillStyle = 'rgba(255,255,255,0.92)'
    g.font = `500 ${S * 0.022}px ${FONT}`
    g.textAlign = 'center'
    g.fillText(album.title.toUpperCase(), cx, cx - S * 0.04)
    g.font = `400 ${S * 0.018}px ${FONT}`
    g.fillText(album.artist, cx, cx + S * 0.05)
  }
  g.restore()
  g.strokeStyle = 'rgba(0,0,0,0.4)'
  g.lineWidth = 2
  g.beginPath()
  g.arc(cx, cx, rLabel, 0, Math.PI * 2)
  g.stroke()

  // spindle hole
  g.fillStyle = '#111'
  g.beginPath()
  g.arc(cx, cx, S * 0.008, 0, Math.PI * 2)
  g.fill()

  return tex(canvas)
}

export interface SleeveTextures {
  front: THREE.CanvasTexture
  back: THREE.CanvasTexture
  spine: THREE.CanvasTexture
  edge: THREE.MeshStandardMaterial
}

function paperColor(accent: string): string {
  return accent
}

export function sleeveTextures(album: Album): SleeveTextures {
  const S = 1024

  // front: the cover
  const front = makeCanvas(S, S)
  if (album.coverImg) {
    front.g.drawImage(album.coverImg, 0, 0, S, S)
  } else {
    front.g.fillStyle = paperColor(album.accent)
    front.g.fillRect(0, 0, S, S)
    front.g.fillStyle = 'rgba(255,255,255,0.94)'
    front.g.font = `700 ${S * 0.07}px ${FONT}`
    front.g.textAlign = 'left'
    front.g.fillText(album.title, S * 0.08, S * 0.18)
    front.g.font = `400 ${S * 0.04}px ${FONT}`
    front.g.fillText(album.artist, S * 0.08, S * 0.26)
  }

  // back: muted panel + track list
  const back = makeCanvas(S, S)
  back.g.fillStyle = '#e9e5dd'
  back.g.fillRect(0, 0, S, S)
  back.g.fillStyle = '#2b2926'
  back.g.font = `600 ${S * 0.032}px ${FONT}`
  back.g.fillText(album.title, S * 0.08, S * 0.12)
  back.g.font = `400 ${S * 0.026}px ${FONT}`
  back.g.fillText(album.artist + (album.year ? ` — ${album.year}` : ''), S * 0.08, S * 0.17)
  back.g.font = `400 ${S * 0.024}px ${FONT}`
  album.tracks.slice(0, 16).forEach((t, i) => {
    back.g.fillText(`${i + 1}.  ${t.name}`, S * 0.08, S * 0.26 + i * S * 0.042)
  })

  // spine: accent bar with rotated text (drawn for a face that is S*0.045 wide)
  const W = 96
  const spine = makeCanvas(W, S)
  spine.g.fillStyle = paperColor(album.accent)
  spine.g.fillRect(0, 0, W, S)
  spine.g.save()
  spine.g.translate(W / 2, S * 0.04)
  spine.g.rotate(Math.PI / 2)
  spine.g.fillStyle = 'rgba(255,255,255,0.95)'
  spine.g.font = `500 ${W * 0.42}px ${FONT}`
  spine.g.textBaseline = 'middle'
  spine.g.fillText(`${album.artist}  —  ${album.title}`, 0, 0)
  spine.g.restore()

  const edge = new THREE.MeshStandardMaterial({ color: '#dedad2', roughness: 0.9 })

  return { front: tex(front.canvas), back: tex(back.canvas), spine: tex(spine.canvas), edge }
}

/** simple oak plank texture */
export function woodTexture(repeatX = 1, repeatY = 1, light = false): THREE.CanvasTexture {
  const W = 512
  const { canvas, g } = makeCanvas(W, W)
  const base = light ? '#d9bf9c' : '#c9aa7c'
  g.fillStyle = base
  g.fillRect(0, 0, W, W)
  // grain streaks
  for (let i = 0; i < 240; i++) {
    const y = Math.random() * W
    const len = 40 + Math.random() * 200
    const x = Math.random() * W
    g.strokeStyle = `rgba(${90 + Math.random() * 60}, ${60 + Math.random() * 40}, ${30 + Math.random() * 25}, ${0.05 + Math.random() * 0.08})`
    g.lineWidth = 0.8 + Math.random() * 1.6
    g.beginPath()
    g.moveTo(x, y)
    g.bezierCurveTo(x + len * 0.3, y + 2, x + len * 0.6, y - 2, x + len, y + 1)
    g.stroke()
  }
  // plank seams
  const planks = 5
  for (let i = 1; i < planks; i++) {
    g.strokeStyle = 'rgba(60,40,20,0.35)'
    g.lineWidth = 1.5
    g.beginPath()
    g.moveTo(0, (W / planks) * i)
    g.lineTo(W, (W / planks) * i)
    g.stroke()
  }
  const t = tex(canvas)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeatX, repeatY)
  return t
}
