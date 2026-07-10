import { Effect, BlendFunction, EffectAttribute } from 'postprocessing'
import { Uniform } from 'three'

const fragmentShader = /* glsl */ `
uniform float radius;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // Window / sun shafts are screen-right — stronger blur there, gentler on the left.
  float side = smoothstep(0.08, 0.82, uv.x);
  float weight = mix(0.38, 1.0, side);
  vec2 texel = (radius * weight) / resolution;

  vec4 nX = texture2D(inputBuffer, uv + vec2(texel.x, 0.0));
  vec4 pX = texture2D(inputBuffer, uv - vec2(texel.x, 0.0));
  vec4 nY = texture2D(inputBuffer, uv + vec2(0.0, texel.y));
  vec4 pY = texture2D(inputBuffer, uv - vec2(0.0, texel.y));

  vec4 sum = inputColor + nX + pX + nY + pY;
  vec4 blurred = sum * 0.2;

  // Screen-space blur smears glass/transmission edges hardest — neighbors mix
  // chassis, vinyl, and background in one kernel. Ease off where taps disagree.
  vec3 spread = max(max(abs(inputColor.rgb - nX.rgb), abs(inputColor.rgb - pX.rgb)),
                     max(abs(inputColor.rgb - nY.rgb), abs(inputColor.rgb - pY.rgb)));
  float edge = clamp(max(spread.r, max(spread.g, spread.b)) * 5.5, 0.0, 1.0);
  float keepSharp = 1.0 - edge * 0.88;

  outputColor = mix(inputColor, blurred, weight * keepSharp);
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
