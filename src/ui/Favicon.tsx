import { useEffect } from 'react'
import { engine } from '../audio/engine'

const SIZE = 64
const PLATTER_RPS = 3.4907

let faviconLink: HTMLLinkElement | null = null

function ensureFaviconLink(): HTMLLinkElement {
  if (faviconLink?.isConnected) return faviconLink
  faviconLink = document.querySelector('link[rel="icon"]')
  if (!faviconLink) {
    faviconLink = document.createElement('link')
    faviconLink.rel = 'icon'
    document.head.appendChild(faviconLink)
  }
  faviconLink.type = 'image/png'
  return faviconLink
}

function drawVinyl(ctx: CanvasRenderingContext2D, angle: number) {
  const cx = SIZE / 2
  const cy = SIZE / 2
  const r = SIZE / 2 - 2

  ctx.clearRect(0, 0, SIZE, SIZE)

  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = '#181818'
  ctx.fill()

  ctx.strokeStyle = '#2a2a2a'
  ctx.lineWidth = 1
  for (let t = 0.38; t <= 0.92; t += 0.14) {
    ctx.beginPath()
    ctx.arc(cx, cy, r * t, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(angle)
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.82, -0.15, 0.55)
  ctx.strokeStyle = '#3d3d3d'
  ctx.lineWidth = 2.5
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.62, 1.2, 1.85)
  ctx.strokeStyle = '#333333'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.restore()

  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.27, 0, Math.PI * 2)
  ctx.fillStyle = '#c8b8a0'
  ctx.fill()

  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.055, 0, Math.PI * 2)
  ctx.fillStyle = '#0c0c0c'
  ctx.fill()
}

export function VinylFavicon() {
  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = SIZE
    canvas.height = SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let angle = 0
    let lastAngle = 0
    let wasPlaying = false
    let lastStamp = performance.now()
    let raf = 0

    const paint = () => {
      drawVinyl(ctx, angle)
      ensureFaviconLink().href = canvas.toDataURL('image/png')
      lastAngle = angle
    }

    paint()

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - lastStamp) / 1000)
      lastStamp = now

      const playing = engine.isPlaying()
      if (playing) {
        angle -= engine.rate * PLATTER_RPS * dt
      }

      const angleStep = Math.abs(angle - lastAngle)
      if (playing !== wasPlaying || (playing && angleStep > 0.04)) {
        paint()
      }
      wasPlaying = playing
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return null
}
