import type { ResolutionMode } from '../state/settings'

export type GpuBenchmarkResult = {
  mode: ResolutionMode
  medianMs: number
  renderer: string
  pixels: number
}

const SIZE = 768
/** ~6 fullscreen-ish passes at SIZE²; High if median frame ≤ this (≈45fps headroom at 2× DPR). */
const HIGH_THRESHOLD_MS = 14

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`

const FRAG = `#version 300 es
precision highp float;
uniform float uSeed;
out vec4 outColor;
void main() {
  vec2 uv = gl_FragCoord.xy / vec2(${SIZE}.0);
  vec3 c = vec3(0.0);
  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    vec2 off = vec2(sin(fi * 1.7 + uSeed), cos(fi * 2.1)) * 0.015;
    c += vec3(
      sin((uv + off).x * 48.0 + uSeed),
      cos((uv + off).y * 36.0),
      sin((uv.x + uv.y) * 24.0)
    );
  }
  outColor = vec4(c * 0.07, 1.0);
}`

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) || 'shader compile failed')
  }
  return sh
}

function rendererString(gl: WebGL2RenderingContext): string {
  const ext = gl.getExtension('WEBGL_debug_renderer_info')
  if (!ext) return 'unknown'
  return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string
}

function obviousAutoRenderer(renderer: string): boolean {
  const r = renderer.toLowerCase()
  return (
    r.includes('swiftshader') ||
    r.includes('llvmpipe') ||
    r.includes('software') ||
    r.includes('microsoft basic render')
  )
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

/**
 * Quick offscreen WebGL probe — picks `high` vs `auto` resolution only.
 * Runs once per device (see settings.gpuBenchmarked).
 */
export async function runGpuBenchmark(): Promise<GpuBenchmarkResult> {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const gl = canvas.getContext('webgl2', { antialias: false, depth: false, stencil: false })
  if (!gl) {
    return { mode: 'auto', medianMs: Infinity, renderer: 'no-webgl', pixels: SIZE * SIZE }
  }

  const renderer = rendererString(gl)
  if (obviousAutoRenderer(renderer)) {
    return { mode: 'auto', medianMs: Infinity, renderer, pixels: SIZE * SIZE }
  }

  const prog = gl.createProgram()!
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT))
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG))
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    return { mode: 'auto', medianMs: Infinity, renderer, pixels: SIZE * SIZE }
  }

  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  gl.useProgram(prog)
  const loc = gl.getAttribLocation(prog, 'aPos')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  const uSeed = gl.getUniformLocation(prog, 'uSeed')

  const times: number[] = []
  const PASSES = 6
  const FRAMES = 14

  for (let f = 0; f < FRAMES; f++) {
    gl.uniform1f(uSeed, f * 0.31)
    const t0 = performance.now()
    for (let p = 0; p < PASSES; p++) gl.drawArrays(gl.TRIANGLES, 0, 3)
    // Force GPU sync so frame time is measurable (no gl.finish in WebGL core).
    const px = new Uint8Array(4)
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
    times.push(performance.now() - t0)
  }

  gl.deleteProgram(prog)
  gl.deleteBuffer(buf)
  canvas.width = canvas.height = 1

  const medianMs = median(times.slice(3))
  const mode: ResolutionMode = medianMs <= HIGH_THRESHOLD_MS ? 'high' : 'auto'

  return { mode, medianMs, renderer, pixels: SIZE * SIZE }
}
