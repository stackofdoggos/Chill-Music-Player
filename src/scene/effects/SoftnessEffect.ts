import { Effect, BlendFunction, EffectAttribute } from 'postprocessing'
import { Uniform } from 'three'

const fragmentShader = /* glsl */ `
uniform float radius;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // Window / sun shafts are screen-right — stronger blur there, gentler on the left.
  float side = smoothstep(0.08, 0.82, uv.x);
  float weight = mix(0.38, 1.0, side);
  vec2 texel = (radius * weight) / resolution;
  vec4 sum = inputColor;
  sum += texture2D(inputBuffer, uv + vec2(texel.x, 0.0));
  sum += texture2D(inputBuffer, uv - vec2(texel.x, 0.0));
  sum += texture2D(inputBuffer, uv + vec2(0.0, texel.y));
  sum += texture2D(inputBuffer, uv - vec2(0.0, texel.y));
  vec4 blurred = sum * 0.2;
  outputColor = mix(inputColor, blurred, weight);
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
