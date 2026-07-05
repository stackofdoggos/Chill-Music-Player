/** Named empties / anchors exported from public/models/room.glb */
export const ANCHOR_NAMES = [
  'player_root',
  'vinyl_rest',
  'tonearm_pivot',
  'platter_spin',
  'lid_hinge',
  'knob_volume',
  'knob_speed',
  'switch_power',
  'basket_L',
  'basket_R',
  ...Array.from({ length: 6 }, (_, i) => `sleeve_slot_${i}`),
] as const

export type AnchorName = (typeof ANCHOR_NAMES)[number]
