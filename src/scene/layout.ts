import * as THREE from "three";
import type { View } from "../state/store";

export const V3 = (x: number, y: number, z: number) =>
  new THREE.Vector3(x, y, z);

// ---------------- room ----------------
export const ROOM = { w: 6.4, d: 5, h: 2.9, backZ: -2.2 };

// ---------------- desk ----------------
export const DESK = { x: -0.9, z: -1.72, topY: 0.74, w: 1.7, d: 0.62 };

// ---------------- record player (group origin at deck bottom centre) ----------------
export const PLAYER_POS = V3(-0.9, DESK.topY, -1.76);
export const BODY = { w: 0.58, h: 0.115, d: 0.36 };
export const PLATTER = {
  local: new THREE.Vector2(-0.08, 0.0), // x,z on the deck
  r: 0.155,
  topLocalY: BODY.h + 0.024, // deck top + platter height
};
export const VINYL_R = 0.15;
export const GROOVE_OUT = 0.142;
export const GROOVE_IN = 0.058;
export const VINYL_THICKNESS = 0.0024;

/** world position of the vinyl centre when resting on the platter */
export const VINYL_REST = V3(
  PLAYER_POS.x + PLATTER.local.x,
  PLAYER_POS.y + PLATTER.topLocalY + 0.0022 + VINYL_THICKNESS / 2 + 0.0004, // on top of the rubber mat
  PLAYER_POS.z + PLATTER.local.y,
);

// ---------------- tonearm ----------------
// pivot height is set so the stylus tip kisses the vinyl surface at PITCH.down
// (vinyl top ≈ BODY.h + 0.0286; tip hangs 0.0065 below pivot, drops pitch*armLength)
export const ARM = {
  pivotLocal: V3(0.205, BODY.h + 0.038, -0.105),
  length: 0.25,
  yawRest: -0.58,
};

const pivot2 = new THREE.Vector2(ARM.pivotLocal.x, ARM.pivotLocal.z);

/** needle position on the deck plane for a given arm yaw (local x,z) */
export function needleXZ(yaw: number): THREE.Vector2 {
  return new THREE.Vector2(
    pivot2.x + ARM.length * Math.sin(yaw),
    pivot2.y + ARM.length * Math.cos(yaw),
  );
}

export function radiusAtYaw(yaw: number): number {
  return needleXZ(yaw).distanceTo(PLATTER.local);
}

/** yaw pointing straight at the platter centre = minimum reachable radius */
export const YAW_CENTER = Math.atan2(
  PLATTER.local.x - pivot2.x,
  PLATTER.local.y - pivot2.y,
);

/** solve yaw for a target groove radius (monotonic between yawRest and YAW_CENTER) */
export function yawAtRadius(r: number): number {
  let lo = YAW_CENTER; // small radius
  let hi = ARM.yawRest; // large radius
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (radiusAtYaw(mid) < r) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function progressToRadius(p: number): number {
  return GROOVE_OUT - p * (GROOVE_OUT - GROOVE_IN);
}

export function radiusToProgress(r: number): number {
  return THREE.MathUtils.clamp(
    (GROOVE_OUT - r) / (GROOVE_OUT - GROOVE_IN),
    0,
    1,
  );
}

// ---------------- shelf (freestanding walnut bookcase) ----------------
// Proportions measured off the reference photo (records = 0.315 m for scale):
// cross-planks ≈ 0.055 thick, sides ≈ 0.07, openings ≈ 0.34–0.44, w:h ≈ 1:1.32.
export const SHELF = {
  x: 1.1,
  wallZ: ROOM.backZ,
  w: 1.33,
  d: 0.36,
  sideT: 0.07, // thick side panels
  boardT: 0.055, // chunky cross-planks
  backT: 0.018, // back panel thickness
  footH: 0.06,
  /** shelf board centre heights, bottom → top (wicker bins live below boardY[0]) */
  boardY: [0.4675, 0.8625, 1.2925],
  topBoardY: 1.7225,
  sideTopY: 1.75, // side panels finish flush with the top board
};

export const SLEEVE = { size: 0.315, thickness: 0.0145 };

/** number of face-forward display slots (3 per row on the top two shelves) */
export const DISPLAY_SLOTS = 6;

/** backward lean of the face-forward sleeves resting against the back panel */
export const SLEEVE_LEAN = 0.13;
/** slot pose faces the front cover (+x face) toward the camera (+z) */
export const SLEEVE_SHELF_ROT_Y = -Math.PI / 2;

/** inner face of the back panel (sleeves lean against this) */
export const SHELF_BACK_INNER_Z = SHELF.wallZ + 0.012 + SHELF.backT;
/** front face of the bookcase; sleeves are staged past this while pulling out */
export const SHELF_FRONT_Z = SHELF.wallZ + SHELF.d;

// ---------------- wicker record bins (pull-out bulk storage) ----------------
export const BASKET = {
  w: 0.48,
  h: 0.29,
  d: 0.32,
  /** centre x of the left and right bins */
  x: [SHELF.x - 0.265, SHELF.x + 0.265],
  /** centre z at rest (front lip slightly proud of the bookcase, like the photo) */
  z: SHELF_FRONT_Z + 0.05 - 0.32 / 2,
  /** forward slide when pulled out */
  outDz: 0.45,
  /** sleeves rise to this height when leaving an open bin */
  riseY: 0.56,
};

/** which bin an overflow album (index >= DISPLAY_SLOTS) lives in */
export function basketIndexFor(albumIndex: number): number {
  return (albumIndex - DISPLAY_SLOTS) % 2;
}

/** home pose of an overflow album standing inside its bin (bin at rest) */
export function basketAlbumSlot(albumIndex: number): THREE.Vector3 {
  const n = albumIndex - DISPLAY_SLOTS;
  const slot = Math.floor(n / 2);
  return V3(
    BASKET.x[basketIndexFor(albumIndex)],
    SLEEVE.size / 2 + 0.085,
    BASKET.z + BASKET.d / 2 - 0.075 - slot * 0.035,
  );
}

export function isShelfFocusPoint(x: number, y: number): boolean {
  const x0 = SHELF.x - SHELF.w / 2 - 0.06;
  const x1 = SHELF.x + SHELF.w / 2 + 0.06;
  return x >= x0 && x <= x1 && y >= 0.2 && y <= SHELF.sideTopY + 0.15;
}

/** framed landscape art above the record player on the back wall */
export const WALL_ART = {
  x: PLAYER_POS.x,
  y: DESK.topY + 0.86,
  z: ROOM.backZ + 0.012,
  width: 0.96,
};

/**
 * Face-forward display slots on the top two shelves, 3 per row, filling the
 * top row first. Sleeves lean back against the back panel like gallery covers.
 * Albums with index >= DISPLAY_SLOTS live in the wicker bins (basketAlbumSlot).
 */
export function sleeveSlot(i: number): THREE.Vector3 {
  if (i >= DISPLAY_SLOTS) return basketAlbumSlot(i);
  const PER_ROW = 3;
  const row = Math.floor(i / PER_ROW); // 0 = top shelf, 1 = shelf below
  const col = i % PER_ROW;
  const innerX0 = SHELF.x - SHELF.w / 2 + SHELF.sideT;
  const innerW = SHELF.w - 2 * SHELF.sideT;
  const spacing = innerW / PER_ROW;
  const boardTop =
    (row === 0 ? SHELF.boardY[2] : SHELF.boardY[1]) + SHELF.boardT / 2;
  const half = SLEEVE.size / 2;
  const halfT = SLEEVE.thickness / 2;
  return V3(
    innerX0 + spacing * (col + 0.5),
    boardTop + half * Math.cos(SLEEVE_LEAN) + halfT * Math.sin(SLEEVE_LEAN),
    SHELF_BACK_INNER_Z + half * Math.sin(SLEEVE_LEAN) + halfT * Math.cos(SLEEVE_LEAN),
  );
}

/** pose of a sleeve pulled out and presented to the camera */
export const SLEEVE_OUT_POS = V3(1.09, 1.31, -1.58);
export const SLEEVE_OUT_ROT_Y = -Math.PI / 2; // front cover (+x face) turns to +z

// ---------------- camera stations ----------------
export const STATIONS: Record<
  View,
  { pos: THREE.Vector3; target: THREE.Vector3 }
> = {
  // zoomed to feel close while the desk legs stay at the bottom of frame
  overview: { pos: V3(0.25, 1.36, 1.55), target: V3(0.1, 0.98, -2.0) },
  player: { pos: V3(-0.86, 1.46, -0.58), target: V3(-0.9, 0.84, -1.78) },
  shelf: { pos: V3(1.1, 1.42, -0.55), target: V3(1.1, 1.24, -2.05) },
  // close-up on the volume knob (front face of the chassis)
  volume: { pos: V3(-0.665, 0.875, -1.31), target: V3(-0.665, 0.797, -1.58) },
  // almost straight above the deck, for precise tonearm placement
  arm: { pos: V3(-0.86, 1.78, -1.6), target: V3(-0.9, 0.86, -1.78) },
  // straight-on view of the back-wall painting
  art: { pos: V3(WALL_ART.x, WALL_ART.y, -0.92), target: V3(WALL_ART.x, WALL_ART.y, WALL_ART.z) },
};

/** mouse-parallax amplitude per view (position, target) */
export const PARALLAX: Record<View, [number, number]> = {
  overview: [0.07, 0.015],
  player: [0.07, 0.015],
  shelf: [0.07, 0.015],
  volume: [0.012, 0.003],
  arm: [0.03, 0.006],
  art: [0.012, 0.003],
};

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
