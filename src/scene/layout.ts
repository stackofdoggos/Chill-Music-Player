import * as THREE from 'three'
import type { View } from '../state/store'

export const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

// ---------------- room ----------------
export const ROOM = { w: 6.4, d: 5, h: 2.9, backZ: -2.2 }

// ---------------- desk ----------------
export const DESK = { x: -0.9, z: -1.72, topY: 0.74, w: 1.7, d: 0.62 }

// ---------------- record player (group origin at deck bottom centre) ----------------
export const PLAYER_POS = V3(-0.9, DESK.topY, -1.76)
export const BODY = { w: 0.58, h: 0.115, d: 0.36 }
export const PLATTER = {
  local: new THREE.Vector2(-0.08, 0.0), // x,z on the deck
  r: 0.155,
  topLocalY: BODY.h + 0.024, // deck top + platter height
}
export const VINYL_R = 0.15
export const GROOVE_OUT = 0.142
export const GROOVE_IN = 0.058
export const VINYL_THICKNESS = 0.0024

/** world position of the vinyl centre when resting on the platter */
export const VINYL_REST = V3(
  PLAYER_POS.x + PLATTER.local.x,
  PLAYER_POS.y + PLATTER.topLocalY + 0.0022 + VINYL_THICKNESS / 2 + 0.0004, // on top of the rubber mat
  PLAYER_POS.z + PLATTER.local.y,
)

// ---------------- tonearm ----------------
export const ARM = {
  pivotLocal: V3(0.205, BODY.h + 0.012, -0.105),
  length: 0.25,
  yawRest: -0.58,
}

const pivot2 = new THREE.Vector2(ARM.pivotLocal.x, ARM.pivotLocal.z)

/** needle position on the deck plane for a given arm yaw (local x,z) */
export function needleXZ(yaw: number): THREE.Vector2 {
  return new THREE.Vector2(pivot2.x + ARM.length * Math.sin(yaw), pivot2.y + ARM.length * Math.cos(yaw))
}

export function radiusAtYaw(yaw: number): number {
  return needleXZ(yaw).distanceTo(PLATTER.local)
}

/** yaw pointing straight at the platter centre = minimum reachable radius */
export const YAW_CENTER = Math.atan2(PLATTER.local.x - pivot2.x, PLATTER.local.y - pivot2.y)

/** solve yaw for a target groove radius (monotonic between yawRest and YAW_CENTER) */
export function yawAtRadius(r: number): number {
  let lo = YAW_CENTER // small radius
  let hi = ARM.yawRest // large radius
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (radiusAtYaw(mid) < r) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

export function progressToRadius(p: number): number {
  return GROOVE_OUT - p * (GROOVE_OUT - GROOVE_IN)
}

export function radiusToProgress(r: number): number {
  return THREE.MathUtils.clamp((GROOVE_OUT - r) / (GROOVE_OUT - GROOVE_IN), 0, 1)
}

// ---------------- shelf ----------------
export const SHELF = {
  x: 1.35,
  wallZ: ROOM.backZ,
  shelfY: [0.78, 1.16, 1.66],
  w: 1.16,
  d: 0.3,
  uprightX: [0.8, 1.9],
}

export const SLEEVE = { size: 0.315, thickness: 0.0145 }

export function sleeveSlot(i: number): THREE.Vector3 {
  return V3(0.96 + i * (SLEEVE.thickness + 0.004), SHELF.shelfY[1] + 0.009 + SLEEVE.size / 2, -1.99)
}

/** pose of a sleeve pulled out and presented to the camera */
export const SLEEVE_OUT_POS = V3(1.34, 1.31, -1.58)
export const SLEEVE_OUT_ROT_Y = -Math.PI / 2 // front cover (+x face) turns to +z

// ---------------- camera stations ----------------
export const STATIONS: Record<View, { pos: THREE.Vector3; target: THREE.Vector3 }> = {
  overview: { pos: V3(0.45, 1.4, 2.1), target: V3(0.3, 1.02, -2.0) },
  player: { pos: V3(-0.86, 1.32, -0.62), target: V3(-0.9, 0.8, -1.78) },
  shelf: { pos: V3(1.16, 1.34, -0.78), target: V3(1.18, 1.24, -2.05) },
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}
