import { Effect, CopyPass } from 'postprocessing'
import { LinearFilter, Uniform, WebGLRenderTarget } from 'three'
import type { Texture, WebGLRenderer } from 'three'
import type { WebGLRenderTarget as WebGLRenderTargetType } from 'three'

const fragmentShader = /* glsl */ `
uniform sampler2D historyBuffer;
uniform float blend;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec4 history = texture2D(historyBuffer, uv);
  outputColor = mix(inputColor, history, blend);
}
`

function makeHistoryTarget() {
  const rt = new WebGLRenderTarget(1, 1, {
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
  })
  rt.texture.name = 'TemporalBlend.History'
  return rt
}

export class TemporalBlendEffect extends Effect {
  private historyRead: WebGLRenderTarget
  private historyWrite: WebGLRenderTarget
  private copyPass: CopyPass

  constructor({ blend = 0.14 } = {}) {
    const historyRead = makeHistoryTarget()
    const historyWrite = makeHistoryTarget()
    super('TemporalBlendEffect', fragmentShader, {
      uniforms: new Map<string, Uniform<number | Texture>>([
        ['blend', new Uniform(blend)],
        ['historyBuffer', new Uniform(historyRead.texture)],
      ]),
    })
    this.historyRead = historyRead
    this.historyWrite = historyWrite
    this.copyPass = new CopyPass()
  }

  get blend() {
    return this.uniforms.get('blend')!.value as number
  }

  set blend(value: number) {
    this.uniforms.get('blend')!.value = value
  }

  setSize(width: number, height: number) {
    this.historyRead.setSize(width, height)
    this.historyWrite.setSize(width, height)
    this.copyPass.setSize(width, height)
  }

  initialize() {
    this.uniforms.get('historyBuffer')!.value = this.historyRead.texture
  }

  update(renderer: WebGLRenderer, inputBuffer: WebGLRenderTargetType, deltaTime: number) {
    if (this.blend <= 0.001) return
    this.uniforms.get('historyBuffer')!.value = this.historyRead.texture
    this.copyPass.render(renderer, inputBuffer, this.historyWrite, deltaTime, false)
    const swap = this.historyRead
    this.historyRead = this.historyWrite
    this.historyWrite = swap
  }

  dispose() {
    super.dispose()
    this.historyRead.dispose()
    this.historyWrite.dispose()
    this.copyPass.dispose()
  }
}
