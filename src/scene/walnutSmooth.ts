import * as THREE from 'three'

export type WalnutMapBundle = {
  map: THREE.CanvasTexture
  normalMap: THREE.CanvasTexture
  roughnessMap: THREE.CanvasTexture
}

function sourceImage(tex: THREE.Texture): CanvasImageSource | null {
  const img = tex.image as CanvasImageSource | undefined
  if (!img) return null
  if (img instanceof HTMLImageElement && (!img.complete || img.naturalWidth === 0)) return null
  return img
}

function sizeOf(img: CanvasImageSource): { w: number; h: number } {
  if (img instanceof HTMLImageElement) return { w: img.naturalWidth || img.width, h: img.naturalHeight || img.height }
  if (img instanceof HTMLCanvasElement) return { w: img.width, h: img.height }
  if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) return { w: img.width, h: img.height }
  return { w: 512, h: 512 }
}

/** Normalized 1D Gaussian kernel; radius ≈ 3σ. */
function gaussianKernel(sigma: number): Float32Array {
  const radius = Math.max(1, Math.ceil(sigma * 3))
  const k = new Float32Array(radius * 2 + 1)
  const inv = 1 / (2 * sigma * sigma)
  let sum = 0
  for (let i = -radius; i <= radius; i++) {
    const w = Math.exp(-(i * i) * inv)
    k[i + radius] = w
    sum += w
  }
  for (let i = 0; i < k.length; i++) k[i] /= sum
  return k
}

function convolveSeparable(
  src: Uint8ClampedArray,
  w: number,
  h: number,
  kernel: Float32Array,
): Uint8ClampedArray {
  const radius = (kernel.length - 1) >> 1
  const tmp = new Uint8ClampedArray(src.length)
  const out = new Uint8ClampedArray(src.length)

  // Horizontal
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let k = -radius; k <= radius; k++) {
        const xx = Math.min(w - 1, Math.max(0, x + k))
        const i = (row + xx) << 2
        const wk = kernel[k + radius]
        r += src[i] * wk
        g += src[i + 1] * wk
        b += src[i + 2] * wk
        a += src[i + 3] * wk
      }
      const o = (row + x) << 2
      tmp[o] = r
      tmp[o + 1] = g
      tmp[o + 2] = b
      tmp[o + 3] = a
    }
  }

  // Vertical
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let k = -radius; k <= radius; k++) {
        const yy = Math.min(h - 1, Math.max(0, y + k))
        const i = (yy * w + x) << 2
        const wk = kernel[k + radius]
        r += tmp[i] * wk
        g += tmp[i + 1] * wk
        b += tmp[i + 2] * wk
        a += tmp[i + 3] * wk
      }
      const o = (y * w + x) << 2
      out[o] = r
      out[o + 1] = g
      out[o + 2] = b
      out[o + 3] = a
    }
  }

  return out
}

/**
 * Isotropic Gaussian blur. Large σ is handled by bilinear downscale →
 * small-σ Gaussian → bilinear upscale so the result stays soft (never boxy).
 */
function paintGaussian(dest: HTMLCanvasElement, src: CanvasImageSource, sigmaPx: number) {
  const { w, h } = sizeOf(src)
  if (w < 1 || h < 1) return
  if (dest.width !== w || dest.height !== h) {
    dest.width = w
    dest.height = h
  }
  const ctx = dest.getContext('2d', { willReadFrequently: true })
  if (!ctx) return

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.filter = 'none'
  ctx.clearRect(0, 0, w, h)

  const sigma = Math.max(0, sigmaPx)
  if (sigma < 0.35) {
    ctx.drawImage(src, 0, 0, w, h)
    return
  }

  // Keep working σ ~2–3px so the kernel stays cheap; bilinear mips carry the rest.
  const targetSigma = 2.5
  const scale = Math.min(1, targetSigma / sigma)
  const ww = Math.max(2, Math.round(w * scale))
  const hh = Math.max(2, Math.round(h * scale))
  const workSigma = sigma * (ww / w)

  const work = document.createElement('canvas')
  work.width = ww
  work.height = hh
  const wctx = work.getContext('2d', { willReadFrequently: true })
  if (!wctx) {
    ctx.drawImage(src, 0, 0, w, h)
    return
  }
  wctx.imageSmoothingEnabled = true
  wctx.imageSmoothingQuality = 'high'
  wctx.drawImage(src, 0, 0, ww, hh)

  const img = wctx.getImageData(0, 0, ww, hh)
  const blurred = convolveSeparable(img.data, ww, hh, gaussianKernel(workSigma))
  img.data.set(blurred)
  wctx.putImageData(img, 0, 0)

  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(work, 0, 0, w, h)
}

function paintCopy(dest: HTMLCanvasElement, src: CanvasImageSource) {
  const { w, h } = sizeOf(src)
  if (w < 1 || h < 1) return
  if (dest.width !== w || dest.height !== h) {
    dest.width = w
    dest.height = h
  }
  const ctx = dest.getContext('2d')
  if (!ctx) return
  ctx.filter = 'none'
  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(src, 0, 0, w, h)
}

/** Fixed bookcase grain soften (was settings slider value 20). */
export const BOOKCASE_SMOOTH = 0.2

/**
 * Smoothed clones of the shelf walnut maps. `setAmount(0..1)` re-blurs
 * diffuse / roughness with a true Gaussian; normals stay sharp (strength via
 * `walnutNormalScale`) so lighting does not go faceted.
 */
export function createWalnutSmoothBundle(
  diff: THREE.Texture,
  nor: THREE.Texture,
  rough: THREE.Texture,
): { maps: WalnutMapBundle; setAmount: (amount: number) => void; dispose: () => void } {
  const canvases = {
    map: document.createElement('canvas'),
    normalMap: document.createElement('canvas'),
    roughnessMap: document.createElement('canvas'),
  }

  const mk = (canvas: HTMLCanvasElement, colorSpace: THREE.ColorSpace) => {
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = colorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(1, 1)
    t.anisotropy = 4
    t.needsUpdate = true
    return t
  }

  const maps: WalnutMapBundle = {
    map: mk(canvases.map, THREE.SRGBColorSpace),
    normalMap: mk(canvases.normalMap, THREE.NoColorSpace),
    roughnessMap: mk(canvases.roughnessMap, THREE.NoColorSpace),
  }

  let last = -1
  let normalsReady = false

  const setAmount = (amount: number) => {
    const a = THREE.MathUtils.clamp(amount, 0, 1)
    if (Math.abs(a - last) < 0.002) return

    const srcDiff = sourceImage(diff)
    const srcNor = sourceImage(nor)
    const srcRough = sourceImage(rough)
    if (!srcDiff || !srcNor || !srcRough) return

    last = a
    const { w } = sizeOf(srcDiff)
    // σ in source pixels: 0 → sharp, 1 → ~2% of width (~40px on 2k)
    const sigma = a * w * 0.02

    paintGaussian(canvases.map, srcDiff, sigma)
    paintGaussian(canvases.roughnessMap, srcRough, sigma * 0.85)
    if (!normalsReady) {
      paintCopy(canvases.normalMap, srcNor)
      normalsReady = true
      maps.normalMap.needsUpdate = true
    }

    maps.map.needsUpdate = true
    maps.roughnessMap.needsUpdate = true
  }

  setAmount(0)

  return {
    maps,
    setAmount,
    dispose: () => {
      maps.map.dispose()
      maps.normalMap.dispose()
      maps.roughnessMap.dispose()
    },
  }
}

/** Normal bump strength for a given smooth amount (1 = fully softened). */
export function walnutNormalScale(amount: number): number {
  return THREE.MathUtils.lerp(0.58, 0.08, THREE.MathUtils.clamp(amount, 0, 1))
}

/** Resolve Blender empties (`shelf_board_0`) to the real mesh child (`shelf_board_0_mesh*`). */
export function resolveShelfMesh(
  nodes: Record<string, THREE.Object3D>,
  name: string,
): THREE.Mesh | null {
  const root = nodes[name]
  if (root) {
    if ((root as THREE.Mesh).isMesh && (root as THREE.Mesh).geometry) return root as THREE.Mesh
    let found: THREE.Mesh | null = null
    root.traverse((obj) => {
      if (found || obj === root) return
      if ((obj as THREE.Mesh).isMesh && (obj as THREE.Mesh).geometry) found = obj as THREE.Mesh
    })
    if (found) return found
  }
  for (const [key, obj] of Object.entries(nodes)) {
    if (!key.startsWith(name)) continue
    if ((obj as THREE.Mesh).isMesh && (obj as THREE.Mesh).geometry) return obj as THREE.Mesh
  }
  return null
}
