import { Effect, BlendFunction, EffectAttribute } from 'postprocessing'
import { Uniform } from 'three'

const fragmentShader = /* glsl */ `
uniform float radius;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 texel = radius / resolution;
  vec4 sum = inputColor;
  sum += texture2D(inputBuffer, uv + vec2(texel.x, 0.0));
  sum += texture2D(inputBuffer, uv - vec2(texel.x, 0.0));
  sum += texture2D(inputBuffer, uv + vec2(0.0, texel.y));
  sum += texture2D(inputBuffer, uv - vec2(0.0, texel.y));
  outputColor = sum * 0.2;
}
`

export class SoftnessEffect extends Effect {
  constructor({
    radius = 0.75,
    blendFunction = BlendFunction.NORMAL,
  }: {
    radius?: number
    blendFunction?: BlendFunction
  } = {}) {
    super('SoftnessEffect', fragmentShader, {
      blendFunction,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform<number>>([['radius', new Uniform(radius)]]),
    })
  }

  get radius() {
    return this.uniforms.get('radius')!.value as number
  }

  set radius(value: number) {
    this.uniforms.get('radius')!.value = value
  }
}
