/** Easy-switch studio look for the Yandhi-style loading assemble. */
export const studioTheme = {
  /** Pure white Yandhi production void — change this one value to re-tint. */
  background: '#ffffff',
  ambient: 0.92,
  keyIntensity: 1.15,
  fillIntensity: 0.45,
  /** Soft ground contact shadow (kept subtle on white). */
  contactShadowOpacity: 0.08,
} as const

export type StudioTheme = typeof studioTheme
