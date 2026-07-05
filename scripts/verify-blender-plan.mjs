#!/usr/bin/env node
/**
 * Dump scene coordinates derived from src/scene/layout.ts (+ component offsets).
 * Keeps BLENDER_SCENE_PLAN.md honest: run after editing layout.ts or the plan doc.
 *
 *   node scripts/verify-blender-plan.mjs          # print JSON to stdout
 *   node scripts/verify-blender-plan.mjs --check  # fail if plan doc drifts
 *   node scripts/verify-blender-plan.mjs --write  # write scripts/blender-coordinates.json
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// --- mirror of src/scene/layout.ts (keep in sync manually) ---

const ROOM = { w: 6.4, d: 5, h: 2.9, backZ: -2.2 }
const DESK = { x: -0.9, z: -1.72, topY: 0.74, w: 1.7, d: 0.62 }
const PLAYER_POS = { x: -0.9, y: DESK.topY, z: -1.76 }
const BODY = { w: 0.58, h: 0.115, d: 0.36 }
const PLATTER = { local: { x: -0.08, z: 0 }, r: 0.155, topLocalY: BODY.h + 0.024 }
const VINYL_THICKNESS = 0.0024
const VINYL_R = 0.15
const GROOVE_OUT = 0.142
const GROOVE_IN = 0.058
const ARM = { pivotLocal: { x: 0.205, y: BODY.h + 0.038, z: -0.105 }, length: 0.25, yawRest: -0.58 }
const SHELF = {
  x: 1.1,
  wallZ: ROOM.backZ,
  w: 1.33,
  d: 0.36,
  sideT: 0.07,
  boardT: 0.055,
  backT: 0.018,
  footH: 0.06,
  boardY: [0.4675, 0.8625, 1.2925],
  topBoardY: 1.7225,
  sideTopY: 1.75,
}
const SLEEVE = { size: 0.315, thickness: 0.0145 }
const SLEEVE_LEAN = 0.13
const DISPLAY_SLOTS = 6
const SHELF_BACK_INNER_Z = SHELF.wallZ + 0.012 + SHELF.backT
const SHELF_FRONT_Z = SHELF.wallZ + SHELF.d
const BASKET = {
  w: 0.48,
  h: 0.29,
  d: 0.32,
  x: [SHELF.x - 0.265, SHELF.x + 0.265],
  z: SHELF_FRONT_Z + 0.05 - 0.32 / 2,
  outDz: 0.45,
}
const WALL_ART = { x: PLAYER_POS.x, y: DESK.topY + 0.86, z: ROOM.backZ + 0.012, width: 0.96 }
const SLEEVE_OUT_POS = { x: 1.09, y: 1.31, z: -1.58 }
const STATIONS = {
  overview: { pos: [0.25, 1.36, 1.55], target: [0.1, 0.98, -2.0] },
  player: { pos: [-0.86, 1.46, -0.58], target: [-0.9, 0.84, -1.78] },
  shelf: { pos: [1.1, 1.42, -0.55], target: [1.1, 1.24, -2.05] },
  volume: { pos: [-0.665, 0.875, -1.31], target: [-0.665, 0.797, -1.58] },
  arm: { pos: [-0.86, 1.78, -1.6], target: [-0.9, 0.86, -1.78] },
  art: { pos: [WALL_ART.x, WALL_ART.y, -0.92], target: [WALL_ART.x, WALL_ART.y, WALL_ART.z] },
}

function v3(x, y, z) {
  return { x, y, z }
}

function sleeveSlot(i) {
  const PER_ROW = 3
  const row = Math.floor(i / PER_ROW)
  const col = i % PER_ROW
  const innerX0 = SHELF.x - SHELF.w / 2 + SHELF.sideT
  const innerW = SHELF.w - 2 * SHELF.sideT
  const spacing = innerW / PER_ROW
  const boardTop = (row === 0 ? SHELF.boardY[2] : SHELF.boardY[1]) + SHELF.boardT / 2
  const half = SLEEVE.size / 2
  const halfT = SLEEVE.thickness / 2
  return v3(
    innerX0 + spacing * (col + 0.5),
    boardTop + half * Math.cos(SLEEVE_LEAN) + halfT * Math.sin(SLEEVE_LEAN),
    SHELF_BACK_INNER_Z + half * Math.sin(SLEEVE_LEAN) + halfT * Math.cos(SLEEVE_LEAN),
  )
}

function needleXZ(yaw) {
  return v3(
    ARM.pivotLocal.x + ARM.length * Math.sin(yaw),
    0,
    ARM.pivotLocal.z + ARM.length * Math.cos(yaw),
  )
}

function playerLocalToWorld(local) {
  return v3(PLAYER_POS.x + local.x, PLAYER_POS.y + local.y, PLAYER_POS.z + local.z)
}

function buildCoordinates() {
  const zMid = SHELF.wallZ + SHELF.d / 2
  const sideH = SHELF.sideTopY - SHELF.footH
  const sideX = [
    SHELF.x - (SHELF.w / 2 - SHELF.sideT / 2),
    SHELF.x + (SHELF.w / 2 - SHELF.sideT / 2),
  ]
  const needleRest = needleXZ(ARM.yawRest)

  const VINYL_REST = v3(
    PLAYER_POS.x + PLATTER.local.x,
    PLAYER_POS.y + PLATTER.topLocalY + 0.0022 + VINYL_THICKNESS / 2 + 0.0004,
    PLAYER_POS.z + PLATTER.local.z,
  )

  const FACE_Z = BODY.d / 2
  const ctrlY = BODY.h * 0.5

  return {
    source: 'src/scene/layout.ts (+ Room/Player/Shelf/RecordTransit offsets)',
    units: 'meters',
    constants: {
      ROOM,
      DESK,
      PLAYER_POS,
      BODY,
      PLATTER,
      VINYL_R,
      VINYL_THICKNESS,
      GROOVE_OUT,
      GROOVE_IN,
      ARM,
      SHELF,
      SLEEVE,
      SLEEVE_LEAN,
      BASKET,
      WALL_ART,
      SLEEVE_OUT_POS,
    },
    derived: {
      VINYL_REST,
      SHELF_zMid: zMid,
      SHELF_FRONT_Z,
      SHELF_BACK_INNER_Z,
      shelf_side_x: sideX,
      shelf_side_y: SHELF.footH + sideH / 2,
      shelf_back_z: SHELF.wallZ + 0.012 + SHELF.backT / 2,
      plant: v3(SHELF.x - 0.45, SHELF.topBoardY + SHELF.boardT / 2 + 0.035, SHELF.wallZ + 0.19),
      tonearm_pivot_world: playerLocalToWorld(ARM.pivotLocal),
      needle_rest_world: v3(PLAYER_POS.x + needleRest.x, 0, PLAYER_POS.z + needleRest.z),
    },
    anchors: {
      player_root: PLAYER_POS,
      vinyl_rest: VINYL_REST,
      tonearm_pivot: playerLocalToWorld(ARM.pivotLocal),
      platter_spin: playerLocalToWorld(v3(PLATTER.local.x, BODY.h, PLATTER.local.z)),
      ...Object.fromEntries([...Array(DISPLAY_SLOTS)].map((_, i) => [`sleeve_slot_${i}`, sleeveSlot(i)])),
      basket_L: v3(BASKET.x[0], 0, BASKET.z),
      basket_R: v3(BASKET.x[1], 0, BASKET.z),
    },
    controls_player_local: {
      switch_power: v3(0.09, ctrlY, FACE_Z),
      knob_speed: v3(0.155, ctrlY, FACE_Z),
      knob_volume: v3(0.235, ctrlY, FACE_Z),
    },
    controls_world: {
      switch_power: playerLocalToWorld(v3(0.09, ctrlY, FACE_Z)),
      knob_speed: playerLocalToWorld(v3(0.155, ctrlY, FACE_Z)),
      knob_volume: playerLocalToWorld(v3(0.235, ctrlY, FACE_Z)),
    },
    room: {
      floor: { centre: v3(0, 0, 0), size: [ROOM.w, ROOM.d] },
      wall_back: { centre: v3(0, ROOM.h / 2, ROOM.backZ), size: [ROOM.w, ROOM.h] },
      wall_left: { centre: v3(-ROOM.w / 2, ROOM.h / 2, 0), size: [ROOM.d + 2, ROOM.h] },
      wall_right: { centre: v3(ROOM.w / 2, ROOM.h / 2, 0), size: [ROOM.d + 2, ROOM.h] },
      ceiling: { centre: v3(0, ROOM.h, 0), size: [ROOM.w, ROOM.d + 2] },
      window: { centre: v3(ROOM.w / 2 - 0.012, 1.45, -0.55), size: [1.35, 1.05] },
      skirting: { centre: v3(0, 0.045, ROOM.backZ + 0.008), size: [ROOM.w, 0.09, 0.014] },
    },
    desk: {
      group: v3(DESK.x, 0, DESK.z),
      top: v3(DESK.x, DESK.topY - 0.025, DESK.z),
      top_size: [DESK.w, 0.05, DESK.d],
    },
    record_transit_curve: [
      SLEEVE_OUT_POS,
      v3(0.82, 1.4, -1.42),
      v3(-0.15, 1.18, -1.52),
      v3(VINYL_REST.x + 0.01, VINYL_REST.y + 0.13, VINYL_REST.z + 0.015),
      VINYL_REST,
    ],
    cameras: STATIONS,
  }
}

function round3(n) {
  return Math.round(n * 1000) / 1000
}

function fmt3(v) {
  return `(${round3(v.x)}, ${round3(v.y)}, ${round3(v.z)})`
}

function checkPlan(doc, coords) {
  const errors = []
  const mustContain = [
    ['PLAYER_POS', fmt3(coords.constants.PLAYER_POS)],
    ['VINYL_REST', fmt3(coords.derived.VINYL_REST)],
    ['shelf_side_L', `(**${round3(coords.derived.shelf_side_x[0])}**`],
    ['shelf_side_R', `(**${round3(coords.derived.shelf_side_x[1])}**`],
    ['WALL_ART', fmt3(coords.constants.WALL_ART)],
    ['basket_L', `(**${round3(coords.anchors.basket_L.x)}**`],
  ]

  for (const [label, needle] of mustContain) {
    if (!doc.includes(needle)) {
      errors.push(`${label}: plan missing \`${needle}\``)
    }
  }

  for (let i = 0; i < DISPLAY_SLOTS; i++) {
    const slot = coords.anchors[`sleeve_slot_${i}`]
    const needle = `(**${round3(slot.x)}**, **${round3(slot.y)}**, **${round3(slot.z)}**)`
    if (!doc.includes(needle)) {
      errors.push(`sleeve_slot_${i}: plan missing \`${needle}\``)
    }
  }

  return errors
}

const args = process.argv.slice(2)
const coords = buildCoordinates()
const root = process.cwd()

if (args.includes('--write')) {
  const out = join(root, 'scripts/blender-coordinates.json')
  writeFileSync(out, JSON.stringify(coords, null, 2) + '\n')
  console.log(`Wrote ${out}`)
}

if (args.includes('--check')) {
  const planPath = join(root, 'BLENDER_SCENE_PLAN.md')
  const doc = readFileSync(planPath, 'utf8')
  const errors = checkPlan(doc, coords)
  if (errors.length) {
    console.error('BLENDER_SCENE_PLAN.md drift detected:\n')
    for (const e of errors) console.error(`  • ${e}`)
    console.error('\nFix the plan doc or re-run: node scripts/verify-blender-plan.mjs --write')
    process.exit(1)
  }
  console.log('BLENDER_SCENE_PLAN.md matches layout.ts coordinates.')
}

if (!args.includes('--check') && !args.includes('--write')) {
  console.log(JSON.stringify(coords, null, 2))
}
