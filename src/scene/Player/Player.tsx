import { Platter } from './Platter'
import { Tonearm } from './Tonearm'
import { Knobs } from './Knobs'
import { Lid } from './Lid'

/** Static player meshes live in room.glb; this group mounts interactives only. */
export function Player() {
  return (
    <>
      <Platter />
      <Tonearm />
      <Knobs />
      <Lid />
    </>
  )
}
