# Agent Guide — Chill Music Player

How to reliably debug and extend this project. **Keep this file updated**: whenever you
discover a new pitfall, debugging technique, or change an architectural fact below, edit
this file in the same change.

## What this is

A 3D record room (React Three Fiber + Vite + TS). The user pulls album sleeves from a
shelf, places the vinyl on a Braun SK4-style player, and controls it with a power switch,
volume knob, 33/45 selector, and a draggable tonearm. Audio is real downloaded albums in
`public/albums/` plus fully synthesized foley (`src/audio/sfx.ts` — no sound files).

## Architecture map

| File | Owns |
| --- | --- |
| `src/state/store.ts` | zustand store: `view`, `selectedAlbumId` (shelf browse), `platterAlbumId`, `shelfPhase` + `recordPhase`, power/volume/speed/needle. Also `requestUnfocus()` + drag-end suppression. |
| `src/scene/layout.ts` | **Single source of truth for all world coordinates**: room/desk/player/shelf positions, camera stations per view, tonearm geometry solver (yaw ↔ groove radius ↔ album progress). |
| `src/audio/engine.ts` | Singleton Web Audio engine. Platter physics (`rate`, `platterAngle`), media element + vinyl EQ, crackle/hum layers, SFX playback, needle drop/seek logic. |
| `src/scene/CameraRig.tsx` | Damped fly-to between `STATIONS[view]` + mouse parallax. |
| `src/scene/RecordTransit.tsx` | The vinyl while traveling sleeve ↔ platter (CatmullRom path, keyed off `recordPhase` + `phaseStart`). |
| `src/scene/Player/*` | Chassis, platter, tonearm (drag → groove radius → seek), knobs, acrylic lid. |
| `src/scene/Shelf/*` | 606 shelf, album sleeves (canvas textures from cover art), vinyl disc mesh. |
| `scripts/fetch-albums.mjs` | yt-dlp + iTunes pipeline that builds `public/albums/` + `manifest.json`. |

State machine: `shelfPhase`: `none → pullingOut → out` (browsing covers on the shelf, independent of the platter).
`recordPhase`: `none → toPlatter → onPlatter → returning → none` (vinyl on the player). `platterAlbumId` tracks which album is on the platter; `selectedAlbumId` is which sleeve is pulled out. While `onPlatter`, users can still pull out other sleeves to browse — `placeRecord` alone shows the return-first hint.
Views: `overview | shelf | player | volume (knob close-up) | arm (top-down tonearm)`.
Unfocus order: `volume/arm → player`, `player/shelf → overview` (see `BACK` in store).
Entering the precision views: click the volume knob → `volume` (drag or arrow keys adjust);
click the tonearm bearing base/pivot column → `arm` (top-down); clicking the base again, the
chassis, or anywhere off the player steps back. Unfocusing the player only happens by clicking
off it or returning the record — never as a side effect of a drag.

## Dev helpers (exposed on `window` in dev builds only)

- `__store` — the zustand store. `__store.getState()` for everything; call actions directly.
- `__engine` — the audio engine. Useful: `.rate`, `.getProgress()`, `.needleDown`, `.platterAngle`.
- `__proj(x, y, z)` — projects a world point to client pixel coords via the live camera.
  Use this to compute click targets instead of guessing from screenshots.

## Driving the app headlessly (browser MCP / CDP)

R3F reads `event.offsetX/offsetY`, which are **0 on synthetic PointerEvents** — you must
override them. Paste this once per page load (`Runtime.evaluate`):

```js
window.__mk = (type, x, y, buttons) => { const e = new PointerEvent(type, {clientX: x, clientY: y,
  bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, button: 0, buttons, pointerType: 'mouse'});
  Object.defineProperty(e, 'offsetX', {get: () => x}); Object.defineProperty(e, 'offsetY', {get: () => y}); return e; };
window.__click = (x, y) => { const c = document.querySelector('canvas');
  c.dispatchEvent(window.__mk('pointermove', x, y, 0)); c.dispatchEvent(window.__mk('pointerdown', x, y, 1));
  c.dispatchEvent(window.__mk('pointerup', x, y, 0));
  const ce = new MouseEvent('click', {clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0});
  Object.defineProperty(ce, 'offsetX', {get: () => x}); Object.defineProperty(ce, 'offsetY', {get: () => y});
  c.dispatchEvent(ce); };
window.__drag = async (fx, fy, tx, ty, steps = 12) => { const c = document.querySelector('canvas');
  c.dispatchEvent(window.__mk('pointermove', fx, fy, 0)); c.dispatchEvent(window.__mk('pointerdown', fx, fy, 1));
  for (let i = 1; i <= steps; i++) { c.dispatchEvent(window.__mk('pointermove', fx + (tx-fx)*i/steps, fy + (ty-fy)*i/steps, 1));
    await new Promise(r => setTimeout(r, 50)); } c.dispatchEvent(window.__mk('pointerup', tx, ty, 0)); };
```

Typical test flow (wait ~2s between steps for camera/phase animations):

```js
// audio requires a user gesture: click the "Enter — sound on" button first (it has an a11y ref)
p = __proj(0.71, 1.33, -1.835); __click(...p)          // click first spine (walks to shelf, then selects)
p = __proj(...SLEEVE_OUT_POS); __click(...p)            // place record (see layout.ts for current value)
p = __proj(-0.81, 0.7975, -1.58); __click(...p)         // power switch
g = __proj(-0.7635, 0.9, -1.7605); d = __proj(-0.88, 0.9, -1.64); await __drag(...g, ...d) // drop needle
__engine.getProgress()                                   // should advance while playing
```

## Known pitfalls (learned the hard way)

1. **HMR resets singletons.** Editing `store.ts` or `engine.ts` swaps the module instance;
   the running scene keeps stale references and the AudioContext is orphaned. After editing
   either, **reload the page and replay the flow** before judging behavior.
2. **Conditional hooks silently blank the screen.** A hook behind `&&` short-circuit (hook
   count changes between renders) makes React unmount the whole Canvas with *no console
   error captured*. Symptom: page goes solid beige, `document.querySelector('canvas')`
   is `null`. Check hook order in recently edited components first.
3. **Screenshots ≠ viewport.** The IDE browser screenshot can be cropped/scaled vs the real
   window. Before coordinate-sensitive testing, set an explicit viewport:
   `Emulation.setDeviceMetricsOverride {width:1440, height:810, deviceScaleFactor:1, mobile:false}`
   (and `Emulation.clearDeviceMetricsOverride` when done). Always compute click points with
   `__proj`, never by eyeballing screenshots.
4. **iTunes durations ≠ actual audio durations.** Manifest `durationMs` comes from iTunes;
   the YouTube audio differs. The engine re-reads `el.duration` on `loadedmetadata` and
   clamps seeks. Some tracks have no iTunes duration at all (fallback 240s).
5. **yt-dlp needs a JS runtime.** Run with `--js-runtimes node` (no deno installed) and keep
   yt-dlp updated, or every download fails with "Requested format is not available".
6. **Audio is gesture-gated.** Nothing initializes until the loading-screen button is
   clicked (`engine.init()`). `el.preservesPitch = false` is what makes spin-up/down bend pitch.
7. **Focus/unfocus is intentional.** Clicking walls/floor/`onPointerMissed` calls
   `requestUnfocus()`, which is suppressed while a knob/tonearm drag is active or ended
   <350ms ago (`markDragEnd`). Don't "fix" wall clicks to switch views directly.
8. **Tonearm math.** Needle position is solved numerically (`yawAtRadius`); groove radius maps
   linearly to album progress (`GROOVE_OUT` → `GROOVE_IN`). Drop tolerance is a few mm beyond
   the groove band. The drag plane is the platter-top plane, not the deck. The pivot height in
   `layout.ts` is calibrated so the stylus tip touches the vinyl exactly at `PITCH.down` —
   if you move the platter/vinyl height, recalibrate (comment above `ARM` shows the math).
9. **r3f events propagate through ALL ray intersections** (no occlusion) until
   `stopPropagation()`. Two consequences seen in practice: (a) a `pointerdown` passes through
   a click-only object to a draggable object behind it — the tonearm base group has
   `onPointerDown={stopPropagation}` for exactly this; (b) the trailing browser `click` after
   any drag lands on whatever is under the cursor — every click handler that must not react
   to that (`focus`, lid toggle, power, speed, record return, view changes) is guarded with
   `dragActiveOrRecent()` from the store.
10. **Pointer capture can leak with synthetic events.** `setPointerCapture` on a fake
   `pointerId` may throw or never get released (no real `lostpointercapture`), after which the
   captured object swallows every pointer event. The tonearm wraps capture/release in
   try/catch and explicitly calls `releasePointerCapture` in `onUp`. If clicks mysteriously
   stop hitting objects during automation, suspect a stale capture — reload the page.
11. **Raycast diagnosis.** `window.__hits(clientX, clientY)` (dev only) lists the first 8
   intersections at a screen point, nearest first — use it whenever a click "does nothing".
   Note it ignores `visible=false` differences from r3f's raycaster; named meshes
   (`arm-base`, `arm-pivot-column`) read clearest.

## Verification checklist

- `npx tsc --noEmit` — must be clean.
- `npx vite build` — chunk-size warning for three.js is expected; anything else is not.
- In-browser: full flow above; `__engine.getProgress()` advancing; check 60fps with a
  2s `requestAnimationFrame` counter; `window.__errs`-style console capture for errors.
- Dev server usually already running at `http://localhost:5173` — check terminals first.
