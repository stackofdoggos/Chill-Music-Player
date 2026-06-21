import * as THREE from 'three'

/** 0–1 cycle: night → dawn → day → golden hour → sunset → dusk → night */
export type Atmosphere = {
  background: THREE.Color
  hemiSky: THREE.Color
  hemiGround: THREE.Color
  hemiIntensity: number
  keyColor: THREE.Color
  keyIntensity: number
  keyPos: THREE.Vector3
  keyTarget: THREE.Vector3
  fillColor: THREE.Color
  fillIntensity: number
  fillPos: THREE.Vector3
  lampColor: THREE.Color
  lampIntensity: number
  windowEmissive: THREE.Color
  windowEmissiveIntensity: number
  ceilingEmissive: THREE.Color
  ceilingEmissiveIntensity: number
  wallColor: THREE.Color
  environmentIntensity: number
  sunAngle: number
  bloomIntensity: number
  bloomThreshold: number
  vignetteOffset: number
  vignetteDarkness: number
}

type RawKeyframe = {
  t: number
  label: string
  background: string
  hemiSky: string
  hemiGround: string
  hemiIntensity: number
  keyColor: string
  keyIntensity: number
  keyPos: [number, number, number]
  keyTarget: [number, number, number]
  fillColor: string
  fillIntensity: number
  fillPos: [number, number, number]
  lampColor: string
  lampIntensity: number
  windowEmissive: string
  windowEmissiveIntensity: number
  ceilingEmissive: string
  ceilingEmissiveIntensity: number
  wallColor: string
  environmentIntensity: number
  sunAngle: number
  bloomIntensity: number
  bloomThreshold: number
  vignetteOffset: number
  vignetteDarkness: number
}

const KEYFRAMES: RawKeyframe[] = [
  {
    t: 0,
    label: 'Night',
    background: '#080a10',
    hemiSky: '#141c2a',
    hemiGround: '#040508',
    hemiIntensity: 0.04,
    keyColor: '#5a78a8',
    keyIntensity: 0.12,
    keyPos: [-3.2, 2.6, 1.0],
    keyTarget: [-0.5, 0, -1.2],
    fillColor: '#1a2030',
    fillIntensity: 0,
    fillPos: [-1.5, 1.2, 2.5],
    lampColor: '#ffb070',
    lampIntensity: 0.28,
    windowEmissive: '#0a1020',
    windowEmissiveIntensity: 0,
    ceilingEmissive: '#1a2030',
    ceilingEmissiveIntensity: 0.03,
    wallColor: '#2a3038',
    environmentIntensity: 0.02,
    sunAngle: 0.32,
    bloomIntensity: 0.08,
    bloomThreshold: 0.92,
    vignetteOffset: 0.32,
    vignetteDarkness: 0.78,
  },
  {
    t: 0.22,
    label: 'Dawn',
    background: '#8a9ab0',
    hemiSky: '#c8d8f0',
    hemiGround: '#6a7888',
    hemiIntensity: 0.35,
    keyColor: '#ffd8c0',
    keyIntensity: 0.65,
    keyPos: [3.0, 1.1, 2.0],
    keyTarget: [-0.9, 0.25, -1.55],
    fillColor: '#b8c8e0',
    fillIntensity: 0.22,
    fillPos: [-2, 1.5, 2.2],
    lampColor: '#ffb070',
    lampIntensity: 0.15,
    windowEmissive: '#ffe8d0',
    windowEmissiveIntensity: 0.35,
    ceilingEmissive: '#d8dce8',
    ceilingEmissiveIntensity: 0.25,
    wallColor: '#d8dce4',
    environmentIntensity: 0.35,
    sunAngle: 0.48,
    bloomIntensity: 0.22,
    bloomThreshold: 0.75,
    vignetteOffset: 0.24,
    vignetteDarkness: 0.48,
  },
  {
    t: 0.38,
    label: 'Morning',
    background: '#dce4ec',
    hemiSky: '#f0f4f8',
    hemiGround: '#b8c0c8',
    hemiIntensity: 0.55,
    keyColor: '#fff0e0',
    keyIntensity: 1.2,
    keyPos: [2.8, 2.2, 1.6],
    keyTarget: [-0.5, 0.35, -1.45],
    fillColor: '#d0dce8',
    fillIntensity: 0.3,
    fillPos: [-2, 1.8, 2.2],
    lampColor: '#ffb070',
    lampIntensity: 0,
    windowEmissive: '#fff8f0',
    windowEmissiveIntensity: 0.5,
    ceilingEmissive: '#e8ecf0',
    ceilingEmissiveIntensity: 0.4,
    wallColor: '#ece9e2',
    environmentIntensity: 0.65,
    sunAngle: 0.42,
    bloomIntensity: 0.16,
    bloomThreshold: 0.95,
    vignetteOffset: 0.22,
    vignetteDarkness: 0.4,
  },
  {
    t: 0.48,
    label: 'Day',
    background: '#e8e4dc',
    hemiSky: '#fff6e8',
    hemiGround: '#c4baa8',
    hemiIntensity: 0.7,
    keyColor: '#ffeed6',
    keyIntensity: 1.7,
    keyPos: [2.4, 2.9, 1.7],
    keyTarget: [0, 0, 0],
    fillColor: '#e8eef4',
    fillIntensity: 0.35,
    fillPos: [-2, 1.8, 2.2],
    lampColor: '#ffb070',
    lampIntensity: 0,
    windowEmissive: '#fff5e8',
    windowEmissiveIntensity: 0.55,
    ceilingEmissive: '#b8b4ac',
    ceilingEmissiveIntensity: 0.55,
    wallColor: '#ece9e2',
    environmentIntensity: 1,
    sunAngle: 0.42,
    bloomIntensity: 0.18,
    bloomThreshold: 1.0,
    vignetteOffset: 0.22,
    vignetteDarkness: 0.42,
  },
  {
    t: 0.58,
    label: 'Late afternoon',
    background: '#e0d4c4',
    hemiSky: '#ffe8d4',
    hemiGround: '#b8a898',
    hemiIntensity: 0.62,
    keyColor: '#ffd090',
    keyIntensity: 1.85,
    keyPos: [2.9, 2.0, 0.3],
    keyTarget: [-0.9, 0.5, -1.72],
    fillColor: '#f0d8c8',
    fillIntensity: 0.28,
    fillPos: [-1.8, 1.6, 2.0],
    lampColor: '#ffb070',
    lampIntensity: 0.05,
    windowEmissive: '#ffe0b0',
    windowEmissiveIntensity: 0.85,
    ceilingEmissive: '#d8c8b0',
    ceilingEmissiveIntensity: 0.42,
    wallColor: '#e8ddd0',
    environmentIntensity: 0.9,
    sunAngle: 0.5,
    bloomIntensity: 0.32,
    bloomThreshold: 0.7,
    vignetteOffset: 0.25,
    vignetteDarkness: 0.48,
  },
  {
    t: 0.65,
    label: 'Golden hour',
    background: '#c8a078',
    hemiSky: '#ffd8a8',
    hemiGround: '#8a7058',
    hemiIntensity: 0.48,
    keyColor: '#ff9838',
    keyIntensity: 2.35,
    keyPos: [3.1, 1.35, -0.7],
    keyTarget: [-0.9, 0.45, -1.72],
    fillColor: '#ffcc98',
    fillIntensity: 0.22,
    fillPos: [-1.5, 1.3, 1.8],
    lampColor: '#ffb070',
    lampIntensity: 0.12,
    windowEmissive: '#ffb040',
    windowEmissiveIntensity: 1.65,
    ceilingEmissive: '#e8a060',
    ceilingEmissiveIntensity: 0.38,
    wallColor: '#dcc8a8',
    environmentIntensity: 0.8,
    sunAngle: 0.58,
    bloomIntensity: 0.58,
    bloomThreshold: 0.42,
    vignetteOffset: 0.3,
    vignetteDarkness: 0.56,
  },
  {
    t: 0.74,
    label: 'Sunset',
    background: '#a87858',
    hemiSky: '#f0a868',
    hemiGround: '#6a5040',
    hemiIntensity: 0.38,
    keyColor: '#ff7030',
    keyIntensity: 2.1,
    keyPos: [3.0, 0.9, -1.6],
    keyTarget: [-0.9, 0.2, -1.72],
    fillColor: '#e89060',
    fillIntensity: 0.18,
    fillPos: [-1.2, 1.1, 1.5],
    lampColor: '#ff9040',
    lampIntensity: 0.28,
    windowEmissive: '#ff7828',
    windowEmissiveIntensity: 2.1,
    ceilingEmissive: '#c87848',
    ceilingEmissiveIntensity: 0.32,
    wallColor: '#c8a888',
    environmentIntensity: 0.65,
    sunAngle: 0.62,
    bloomIntensity: 0.68,
    bloomThreshold: 0.35,
    vignetteOffset: 0.32,
    vignetteDarkness: 0.62,
  },
  {
    t: 0.86,
    label: 'Dusk',
    background: '#4a5068',
    hemiSky: '#6878a0',
    hemiGround: '#2a3040',
    hemiIntensity: 0.22,
    keyColor: '#c87858',
    keyIntensity: 0.75,
    keyPos: [2.5, 1.05, -1.1],
    keyTarget: [-0.9, 0.3, -1.65],
    fillColor: '#485878',
    fillIntensity: 0.15,
    fillPos: [-2, 1.4, 2.0],
    lampColor: '#ffb070',
    lampIntensity: 0.42,
    windowEmissive: '#a05840',
    windowEmissiveIntensity: 0.45,
    ceilingEmissive: '#4a5060',
    ceilingEmissiveIntensity: 0.15,
    wallColor: '#6a6878',
    environmentIntensity: 0.12,
    sunAngle: 0.4,
    bloomIntensity: 0.24,
    bloomThreshold: 0.65,
    vignetteOffset: 0.28,
    vignetteDarkness: 0.58,
  },
  {
    t: 1,
    label: 'Night',
    background: '#080a10',
    hemiSky: '#141c2a',
    hemiGround: '#040508',
    hemiIntensity: 0.04,
    keyColor: '#5a78a8',
    keyIntensity: 0.12,
    keyPos: [-3.2, 2.6, 1.0],
    keyTarget: [-0.5, 0, -1.2],
    fillColor: '#1a2030',
    fillIntensity: 0,
    fillPos: [-1.5, 1.2, 2.5],
    lampColor: '#ffb070',
    lampIntensity: 0.28,
    windowEmissive: '#0a1020',
    windowEmissiveIntensity: 0,
    ceilingEmissive: '#1a2030',
    ceilingEmissiveIntensity: 0.03,
    wallColor: '#2a3038',
    environmentIntensity: 0.02,
    sunAngle: 0.32,
    bloomIntensity: 0.08,
    bloomThreshold: 0.92,
    vignetteOffset: 0.32,
    vignetteDarkness: 0.78,
  },
]

const c = (hex: string) => new THREE.Color(hex)
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

function lerpColor(a: THREE.Color, b: THREE.Color, t: number, out: THREE.Color) {
  out.r = a.r + (b.r - a.r) * t
  out.g = a.g + (b.g - a.g) * t
  out.b = a.b + (b.b - a.b) * t
}

function lerpNum(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function lerpVec(a: THREE.Vector3, b: THREE.Vector3, t: number, out: THREE.Vector3) {
  out.x = a.x + (b.x - a.x) * t
  out.y = a.y + (b.y - a.y) * t
  out.z = a.z + (b.z - a.z) * t
}

function lerpRaw(a: RawKeyframe, b: RawKeyframe, t: number, out: Atmosphere): Atmosphere {
  lerpColor(c(a.background), c(b.background), t, out.background)
  lerpColor(c(a.hemiSky), c(b.hemiSky), t, out.hemiSky)
  lerpColor(c(a.hemiGround), c(b.hemiGround), t, out.hemiGround)
  out.hemiIntensity = lerpNum(a.hemiIntensity, b.hemiIntensity, t)
  lerpColor(c(a.keyColor), c(b.keyColor), t, out.keyColor)
  out.keyIntensity = lerpNum(a.keyIntensity, b.keyIntensity, t)
  lerpVec(v(...a.keyPos), v(...b.keyPos), t, out.keyPos)
  lerpVec(v(...a.keyTarget), v(...b.keyTarget), t, out.keyTarget)
  lerpColor(c(a.fillColor), c(b.fillColor), t, out.fillColor)
  out.fillIntensity = lerpNum(a.fillIntensity, b.fillIntensity, t)
  lerpVec(v(...a.fillPos), v(...b.fillPos), t, out.fillPos)
  lerpColor(c(a.lampColor), c(b.lampColor), t, out.lampColor)
  out.lampIntensity = lerpNum(a.lampIntensity, b.lampIntensity, t)
  lerpColor(c(a.windowEmissive), c(b.windowEmissive), t, out.windowEmissive)
  out.windowEmissiveIntensity = lerpNum(a.windowEmissiveIntensity, b.windowEmissiveIntensity, t)
  lerpColor(c(a.ceilingEmissive), c(b.ceilingEmissive), t, out.ceilingEmissive)
  out.ceilingEmissiveIntensity = lerpNum(a.ceilingEmissiveIntensity, b.ceilingEmissiveIntensity, t)
  lerpColor(c(a.wallColor), c(b.wallColor), t, out.wallColor)
  out.environmentIntensity = lerpNum(a.environmentIntensity, b.environmentIntensity, t)
  out.sunAngle = lerpNum(a.sunAngle, b.sunAngle, t)
  out.bloomIntensity = lerpNum(a.bloomIntensity, b.bloomIntensity, t)
  out.bloomThreshold = lerpNum(a.bloomThreshold, b.bloomThreshold, t)
  out.vignetteOffset = lerpNum(a.vignetteOffset, b.vignetteOffset, t)
  out.vignetteDarkness = lerpNum(a.vignetteDarkness, b.vignetteDarkness, t)
  return out
}

const scratch = createAtmosphere()

export function createAtmosphere(): Atmosphere {
  return {
    background: new THREE.Color(),
    hemiSky: new THREE.Color(),
    hemiGround: new THREE.Color(),
    hemiIntensity: 0,
    keyColor: new THREE.Color(),
    keyIntensity: 0,
    keyPos: new THREE.Vector3(),
    keyTarget: new THREE.Vector3(),
    fillColor: new THREE.Color(),
    fillIntensity: 0,
    fillPos: new THREE.Vector3(),
    lampColor: new THREE.Color(),
    lampIntensity: 0,
    windowEmissive: new THREE.Color(),
    windowEmissiveIntensity: 0,
    ceilingEmissive: new THREE.Color(),
    ceilingEmissiveIntensity: 0,
    wallColor: new THREE.Color(),
    environmentIntensity: 0,
    sunAngle: 0,
    bloomIntensity: 0,
    bloomThreshold: 0,
    vignetteOffset: 0,
    vignetteDarkness: 0,
  }
}

/** Sample the full day-night cycle at phase ∈ [0, 1]. */
export function sampleAtmosphere(phase: number, out = scratch): Atmosphere {
  const t = ((phase % 1) + 1) % 1
  let i = 0
  for (let k = 0; k < KEYFRAMES.length - 1; k++) {
    if (t >= KEYFRAMES[k].t) i = k
  }
  const a = KEYFRAMES[i]
  const b = KEYFRAMES[i + 1]
  const span = b.t - a.t
  const local = span > 0 ? (t - a.t) / span : 0
  return lerpRaw(a, b, local, out)
}

/** Label for the nearest keyframe — used by the dev slider. */
export function phaseLabel(phase: number): string {
  const t = ((phase % 1) + 1) % 1
  let best = KEYFRAMES[0]
  let bestDist = Infinity
  for (const kf of KEYFRAMES) {
    const d = Math.min(Math.abs(t - kf.t), Math.abs(t - kf.t + 1), Math.abs(t - kf.t - 1))
    if (d < bestDist) {
      bestDist = d
      best = kf
    }
  }
  return best.label
}
