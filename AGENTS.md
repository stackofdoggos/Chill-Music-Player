# Agent Guide — Chill Music Player

How to reliably debug and extend this project. **Keep this file updated**: whenever you
discover a new pitfall, debugging technique, or change an architectural fact below, edit
this file in the same change.

## What this is

A 3D record room (React Three Fiber + Vite + TS). The user pulls album sleeves from a
shelf, places the vinyl on a Braun SK4-style player, and controls it with a power switch,
volume knob, 33/45 selector, and a draggable tonearm. Audio is real downloaded albums in
`public/albums/` plus sampled foley in `public/sfx/` (see `CREDITS.md`).

## Architecture map

| File | Owns |
| --- | --- |
| `src/state/store.ts` | zustand store: `view`, `selectedAlbumId` (shelf browse), `platterAlbumId`, `shelfPhase` + `recordPhase`, power/volume/speed/needle. Also `requestUnfocus()` + drag-end suppression. |
| `src/loading/introTimeline.ts` | **All Yandhi intro constants**: clip URLs, frame-derived handoff times, beat timings, visit detection (`readIntroMode`), `enterLabel()`. Dev handle: `__intro`. |
| `src/loading/YandhiIntro.tsx` | The loading sequence: unmute gate → buffer gate → assemble → spin loop → outro → reveal. Owns the phase machine and the three stacked `<video>` elements. |
| `src/loading/mediaTiming.ts` | Media primitives: `waitForBuffered`, `atTime`, `once` (with timeout), `align`, `fadeOut`. |
| `src/scene/dayNight.ts` | Keyframed 0–1 day-night atmosphere (lights, bloom, wall/window tints). `dayPhase` in store; panel in `DayNightMenu` (`src/ui/DayNightSlider.tsx`). |
| `src/scene/lightmap.ts` | Baked Cycles GI for the room shell (see "Baked lighting" below). Applies `lightMap` to 5 meshes, moves them to `LIGHTMAP_LAYER`, neutralises their albedo, and cross-fades three baked sets by `dayPhase`. Dev handle: `__lightmap.on()/.off()`. |
| `scripts/bake-lightmaps.py` | Regenerates `public/lightmaps/<set>_<mesh>.png` + `meta.json` from `layout.blend` via the blender-mcp bridge on port 9876. Lights it with a Nishita physical sky per set. ~2min for all three. |
| `src/scene/layout.ts` | **Single source of truth for all world coordinates**: room/desk/player/shelf positions, camera stations per view, tonearm geometry solver (yaw ↔ groove radius ↔ album progress). |
| `src/scene/Lighting.tsx` | Hemisphere + window key/fill directionals, interior lamp, Environment lightformers — all driven by `sampleAtmosphere(dayPhase)`. |
| `src/audio/engine.ts` | Singleton Web Audio engine. Platter physics (`rate`, `platterAngle`), media element + vinyl EQ, quiet groove crackle, SFX playback, needle drop/seek logic. |
| `src/scene/CameraRig.tsx` | Damped fly-to between `STATIONS[view]` + mouse parallax. |
| `src/scene/Volumetrics.tsx` | Fake window sun shafts (additive quads, no raymarch). Intensity = `shaftStrength(atmosphere)` × mode from settings. |
| `src/scene/Experience.tsx` | Canvas root, atmosphere post stack (`PostFxEffects`), shadow quality, DPR from settings + `dayPhase`. |
| `src/state/postFx.ts` | Post FX defaults (`grain`, `temporalBlend`, `softness`, chromatic aberration). Read by `PostFxEffects`. Dev handle: `__postFx`. |
| `scripts/verify-blender-plan.mjs` | Dumps/checks Blender scene coordinates against `layout.ts`; `npm run verify-blender-plan` validates `BLENDER_SCENE_PLAN.md`. |
| `src/state/settings.ts` | Graphics/audio settings zustand store (persisted to localStorage): `softShadows` (VSM vs PCF), `ambientOcclusion` (N8AO), `lightShafts` (off/subtle/pronounced), `resolutionMode` (auto/standard/high — auto blends 1× DPR at golden hour/sunset with device DPR at night), `reflections` (HDRI env map on/off — `Lighting.tsx` unmounts drei `Environment` when off), `crackle` (groove surface noise on/off — engine reads via `useSettings.getState()`). Panel body in `SettingsMenu` (`src/ui/SettingsPanel.tsx`). Dev handle: `__settings`. |
| `layout.blend` → `Hidden/area_rug` | Jute rug kept in Blender (`Hidden` collection, viewport+render off) with maps in `public/textures/rug/`. Not exported to `room.glb` while hidden — unhide/`exclude=False` on `Hidden`, then re-export to bring it back. Click name still listed with floor in `SceneModel.tsx`. |
| `src/scene/walnutSmooth.ts` | Fixed Gaussian soften (`BOOKCASE_SMOOTH = 0.2`) for shelf walnut diffuse/roughness maps; `SceneModel.tsx` applies warm tint + maps to bookcase meshes. |
| `src/state/ui.ts` | Top-left menu chrome: `activeMenu` (`none \| settings \| light`), `toggleMenu()`, `setActiveMenu()`. Single shared blur overlay in `src/ui/TopMenuOverlay.tsx` — never mount a second backdrop when swapping cog ↔ light dot. |
| `src/ui/TopMenuOverlay.tsx` | One `topmenu-overlay` blur for both menus; panel swap animates exit → enter without re-stacking filters. Escape handler lives here. |
| `src/scene/RecordTransit.tsx` | The vinyl while traveling sleeve ↔ platter (CatmullRom path, keyed off `recordPhase` + `phaseStart`). |
| `src/scene/Player/*` | Chassis, platter, tonearm (drag → groove radius → seek), knobs, acrylic lid. |
| `src/scene/Shelf/*` | Freestanding walnut bookcase (PBR maps in `public/textures/`, CC0 — see `public/textures/CREDITS.md`): 3+3 interactive albums face-forward on the top two shelves; albums with index >= `DISPLAY_SLOTS` (6) live inside two pull-out wicker bins on the floor (bulk storage). Decorative spine row on the middle shelf. Also album sleeves (canvas textures from cover art) and the vinyl disc mesh. |
| `scripts/fetch-albums.mjs` | yt-dlp + iTunes pipeline that builds `public/albums/` + `manifest.json`. |

State machine: `shelfPhase`: `none → pullingOut → out` (browsing covers on the shelf, independent of the platter).
`recordPhase`: `none → toPlatter → onPlatter → returning → none` (vinyl on the player). `platterAlbumId` tracks which album is on the platter; `selectedAlbumId` is which sleeve is pulled out. While `onPlatter`, users can still pull out other sleeves to browse — `placeRecord` alone shows the return-first hint.
Views: `overview | shelf | player | volume (knob close-up) | arm (top-down tonearm) | art (painting close-up)`.
Shelf keyboard (when `view === 'shelf'`): `F` flips the pulled-out sleeve; `P` puts it back, pulls
out the hovered sleeve, or swaps to a hovered sleeve while inspecting. `hoveredAlbumId` tracks the
sleeve under the cursor for both `P` and the bottom-left control hints (`src/ui/controlHints.ts`).
Sleeve pull-out/return is staged in `AlbumSleeve.tsx` (slide straight out past `SHELF_FRONT_Z`
before gliding to `SLEEVE_OUT_POS`, and re-align before sliding back in) so covers never clip
through the shelf boards above them.
Wicker bins: `basketOut` in the store tracks which bin is slid forward (clicking a bin toggles
it, no view change). Bin albums (index >= `DISPLAY_SLOTS`) ride their bin's slide, and
`selectAlbum`/`putBackSleeve` auto-open the owning bin so the sleeve rises/descends outside
the bookcase (see `BASKET` in `layout.ts`). `toggleBasket` refuses to close a bin whose album
is still out.
Unfocus order: `volume/arm → player`, `player/shelf → overview` (see `BACK` in store).
Entering the precision views: click the volume knob → `volume` (drag or arrow keys adjust);
click the tonearm bearing base/pivot column → `arm` (top-down); clicking the base again, the
chassis, or anywhere off the player steps back. Unfocusing the player only happens by clicking
off it or returning the record — never as a side effect of a drag.

## The Yandhi intro (loading screen)

Three silent 30fps 1080p clips in `public/loading/` plus one audio track, all rendered from
one Blender rig at 72°/s so they are **phase-locked** — which is why the clip changes need no
cross-fade. Do not re-encode or re-render these without re-deriving the constants:

| clip | frames | notes |
| --- | --- | --- |
| `yandhi_assemble.mp4` | 390 / 13.000s | frames 0–10 are pixel-identical (safe freeze point); still 176–208; sticker slides 209–265; constant rotation 266–389 |
| `yandhi_spin.mp4` | 150 / 5.000s | exactly one 360° revolution, seamless loop |
| `yandhi_disassemble.mp4` | 267 / 8.900s | `reverse(assemble[0..266])`, played at 1.3× |
| `yandhi_intro.m4a` | 53.46s | the full track (see below); its frame 0 is the assemble's frame 0 |

The two identities every handoff depends on:
`assemble[389] == spin[149]` (so assemble → spin[0] continues the rotation) and
`assemble[266] == spin[26] == disassemble[0]` (the face-on pose the outro cuts from).

**The outro ends by opening the room out of the record's spindle hole.** This works because the
assemble was rendered starting *inside* that hole and pulling back, so reversed it flies into it.
The room is lifted above the intro (`z-index`) and revealed with a growing `clip-path: circle()`
— **not** a mask on the video, because only `clip-path` interpolates reliably; animating between
two radial-gradient masks would have to cross-fade them. Nothing about the video being baked
matters: no alpha or depth is needed, the room simply sits behind and the circle grows.
The numbers that make it land (all in `IRIS`):
- The hole's centre holds at **50.0% × 50–52%** of the frame through the whole approach, drifting
  under 0.3%, so a fixed `circle(... at 50% 50%)` tracks it with no motion rig. Because that is
  relative to the clip's own box it stays right at every window shape.
- Freeze on `disassemble[250]` (== `assemble[16]`), where the frame is **pure white edge to edge**
  (0% of it darker than 120) with the hole a grey disc dead centre at **9.04% of frame height**.
  The iris therefore opens through flat colour with no detail to give its edge away, and that
  white is 253 — the same as `--intro-void`.
- **Never let it run past `disassemble[255]`.** `assemble[0..10]` is the blank sleeve held
  pixel-identical and `assemble[11]` hard-cuts to the close-up, so that cut sits at
  `disassemble[256]`, six frames past the freeze. The trigger fires early and then *snaps*:
  snapping back a frame or two is invisible on a still, whereas overshooting shows the cut.
- The room's push-in and the clip radius both animate, so the start radius is divided by the
  starting scale — the two compose back to the measured hole.
- The end radius is `0.51 * hypot(100vw, 100vh)` — just past the half-diagonal, since the corners
  are the last thing the circle reaches. A `vmax` guess safe on a square window (70.7vmax) throws
  away most of the growth on a wide one, which is what made the reveal finish long before the
  transition did.

**The lift comes off before the push-in finishes, and that is what puts the chrome on screen.**
`.scene-wrap--iris` is `z-index: 21` to clear the intro at 20, but it also clears the room's own
gear and light dot at 13, so holding it for the whole reveal kept them hidden — the dot only
appeared at 1018ms, a third of a second after there was nothing left to reveal. So `clip-path` runs
0.65s while `transform` runs 1s, and the `clip-path` `transitionend` moves `iris` to `settling`:
lift off, intro unmounted, push-in still running under the chrome. Two rules hold it together:
- **Unmounting the intro and dropping the lift must happen in the same commit.** Either alone puts
  a full-screen layer over the other — drop the lift first and the white intro paints over the
  room. They are both set in the one handler so React batches them; measured across 181 frames,
  zero had the intro up without the lift.
- **The end values must stay until the push-in lands**, hence `settling` keeping
  `--iris-open` — removing them mid-transform snaps the scale.
Measured at 1440×810: the circle covers the viewport at 489ms, the dot is topmost at its own centre
from 660ms, and the scale reaches exactly 1 before the classes come off (no snap). The 2% margin
holds with no corner leak at 16:9, square, ultrawide and portrait — verified by painting the page
behind the room magenta and counting surviving pixels.

To verify alignment after any change, pin `.scene-wrap--iris-open` to the opening size, screenshot,
then hide `.scene-wrap` and screenshot again: the room circle and the video's hole must measure the
same radius and centre (they currently match to 0.0px).

**The intro plays once, then not again for a week** (`readIntroMode`): `full` on a first visit or
after `FULL_INTRO_AFTER_MS`, `none` otherwise, and `none` never mounts `YandhiIntro` at all — App
renders the room immediately and fades it up when `waitForAssets()` resolves. Two things that path
has to do for itself, because the intro used to do them: refresh `chill.introLastSeen` (or the
week would count from the first visit forever, not the last one) and **build the AudioContext on
the visitor's first gesture**. There is no unmute gate on that path, and a context constructed
outside a gesture starts suspended and stays that way — `engine.init()` has no resume, so calling
it at load would leave the room permanently silent. Note a dispatched `Event` is not a gesture: to
test this you need CDP `Input.dispatchMouseEvent`, not `element.click()`.

**To re-verify after any re-render**: dump frames as raw gray/rgb at low res
(`ffmpeg -vf "scale=48:27,format=gray" -f rawvideo`) and compare with sum-of-absolute-
differences. A true match scores well under 1.0; adjacent frames differ by ~2.2. Face-on is
found as the frame of maximum non-white bounding-box width, disambiguated from the
back-facing pose by colour saturation (34.0 front vs 26.4 back).

Other facts worth keeping:
- **The intro uses two framings and animates between them**, because the clips are composed two
  different ways. The shatter fills the frame edge to edge and has to bleed; everywhere else is
  just the record on flat void, and that record is 92% of the frame height, so bleeding it crops
  its top and bottom on any window wider than ~1.93:1 (most maximised ones). `.intro__clip`
  therefore sizes the element to the clips' own 16:9 rather than using `object-fit` — `min()` is
  contain, `max()` is cover, and width/height animate between them, which `object-fit` can't.
  Both endpoints lie on the same ray from the origin, so the box stays exactly 16:9 across the
  whole move; keep the timing function identical on width, height and scale or that breaks.
  `.intro--bleed` is driven by the phase machine off `ASSEMBLE_SETTLES_AT` (frame 252). The
  border-contact windows, measured by scanning a 3px border of every frame for pixels off the
  corner value: assemble 18–252, disassemble 14–248, spin never. Re-measure if they're
  re-rendered. **The outro is the tight one** — it opens back out on the face-on hold and has
  only ~0.71s before the disassemble's debris reaches the edge, hence the shorter `--clip-move`
  in the bleed state. Verify with the rendered `getBoundingClientRect`, not by simulating the
  fit in a canvas; it's easy to measure your own assumption instead of the page.
- **The clips carry no colour-range tags** (`color_range=unknown`), so decoders apply the bt709
  limited-range default and browsers paint their void at **253**, where `ffmpeg` reads the file
  as 251. `--intro-void` has to match what the *browser* paints, or every gap the framing leaves
  shows up as a faint rectangle outline around the video — a 2/255 step, invisible in isolation
  but plainly visible as a hard edge. Confirmed identical under both of Chrome's GL backends, so
  it comes from the decode and not the compositor. Measure it from a screenshot, not the file.
- **The iMessage bubble tail** uses Samuel Kraft's geometry
  ([ios-chat-bubbles-css](https://samuelkraft.com/blog/ios-chat-bubbles-css)) — the canonical
  recreation. His numbers are quoted against a 25px tail, so `styles.css` stores them as
  ratios of `--tail`, and each bubble sets `--tail` to half its own height (iOS keeps the tail
  height equal to the corner radius, which makes a single-line bubble a true pill). Kraft
  carves the tail with a **page-coloured `::after`**; this uses a two-layer `mask-image`
  instead so the carve is transparent, because here the bubble sits over video rather than a
  known flat colour. If you change `--tail`, change nothing else — the ratios do the rest.
- **The unmute icon** is built to measurements taken off SF Symbols' own `speaker.slash.fill`
  (render it with `NSImage.imageWithSystemSymbolName` via `osascript -l JavaScript`, then
  measure the alpha channel). The ratios, all relative to the cone height: slash ink box
  1.101×, cone inset 9.8% from that box's left and vertically centred, stroke 0.095×, and the
  cut 2.70× the stroke. The slash is 45° but **not** on the viewBox diagonal — it sits lower,
  which is what makes it cross the cone's body instead of shaving off its tip. The gap must be
  a real hole (an SVG `mask`); a page-coloured copy of the slash underneath reads as a pale
  stripe wherever it leaves the cone and crosses the button's gradient.
- Returning visitors download none of the clips at all. Within the full intro, `src` attributes
  are still attached in sequence so the downloads never compete.
- The audio element starts ~50–90ms behind the video even when both are fully buffered;
  `align()` corrects it once, 120ms in, leaving a stable ~50ms. That is well inside the
  threshold for this material (no sharp picture/sound hit points to sync against), so don't
  tighten `align()`'s tolerance to chase it — the correcting seek is itself audible.
- The music is a plain `loop` on the `<audio>` at `MUSIC_VOLUME` (0.6): the spin can be held
  indefinitely, so the track just repeats if it runs out. It is deliberately **not** tied to the
  rotation — don't reintroduce a seek-per-revolution. `fadeOut()` ramps from whatever the
  element's current volume is, so changing `MUSIC_VOLUME` needs nothing else touched.
- **Where the track comes from.** `yandhi_intro.m4a` is the full 53s audio of the source
  video the render was made against (`youtu.be/4S4wRQI1MXc`), fetched with the same yt-dlp
  path as `scripts/fetch-albums.mjs`. The render's own 13s of embedded audio is the **first**
  13s of that track — confirmed by sample-level cross-correlation at r=0.995, so the clip
  and the full track share a timeline and nothing needs re-timing. Two corrections are baked
  into the encode and must be reapplied if you re-fetch: the download is missing the track's
  first 36ms (pure digital silence in the render), so 1742 samples of silence are prepended
  to keep frame 0 honest; and the Opus decode peaks at 1.22, so a 0.804 gain keeps AAC from
  clipping. There is also a 200ms fade on the tail — the track ends loud and mid-phrase, and
  without it the wrap back to the quiet intro clicks.
- Beware when re-deriving the offset: this track's loudness is uniform enough that an
  *envelope* correlation gives a near-tie between lag 0 and a spurious peak at 35.7s
  (r=0.824 vs 0.832). Only sample-level correlation separates them.
- Testing: `?intro=full` / `?intro=none` force a path. `__intro.forget()` /
  `__intro.lastSeenDaysAgo(n)` manipulate the 7-day `chill.introLastSeen` key.

## Baked lighting (room shell)

three.js has no global illumination, and the hemisphere/fill/window lights that
stood in for it add the **same irradiance everywhere** — so the room shell had no
window falloff, no corner darkening and no soft contact shadows. That, not
texture quality, is what made the scene read flat. Cycles bakes those cues into
`public/lightmaps/`.

- **Only five meshes are baked**: `floor`, `ceiling`, `wall_back`, `wall_left`,
  `wall_right`. They are the only ones whose **UV0 is already a clean 0-1
  non-overlapping unwrap** (verified: uvArea == 1.000), so nothing needs
  re-exporting from Blender. Every other mesh (shelf, desk, player) has
  cube-projected overlapping UVs and would need a new UV layer first.
- **`texture.channel = 0`** — three defaults `lightMap` to UV1, and these maps
  live on UV0.
- **What is baked is `total - sun_direct`**: window + sky + all bounce, but not
  direct sunlight. The sun stays real-time so its shadows still sweep.
  `Lighting.tsx` and `bake-lightmaps.py` must agree on this split.
- **Layers do the exclusion.** Baked meshes sit alone on `LIGHTMAP_LAYER`; hemi,
  fill, rect-area and lamp are pinned to layer 0; only the sun enables both.
  three lights a mesh when they share **any** layer, so the shell cannot stay on
  layer 0. Consequences: the camera **and the raycaster** must
  `layers.enable(LIGHTMAP_LAYER)` (`LightmapLayerAccess` in `Experience.tsx`) or
  the shell vanishes and stops answering clicks, and any fresh
  `new THREE.Raycaster()` needs `layers.enableAll()` (`__hits` does).
- **The HDRI is not layer-filtered**, so baked materials get `envMapIntensity = 0`
  or the environment re-flattens what the bake fixed. Same for the ceiling's flat
  emissive.
- **Three sets are baked** — `night`, `day`, `golden` — as
  `public/lightmaps/<set>_<mesh>.png`, anchored at `dayPhase` 0.0 / 0.48 / 0.70
  with `night` repeated at 1.0 so the slider wraps. Two adjacent sets cross-fade
  **in the shader**: `patchForBlend()` in `lightmap.ts` rewrites three's
  `lights_fragment_maps` line to `mix()` a second sampler in. Swapping maps
  instead would pop, and a CPU blend would upload a texture per frame.
- **Scale is per map, not per set.** One small window means `wall_right` and
  `wall_back` differ by ~50× in irradiance; a shared scale left `wall_back`
  quantised to about seven 8-bit codes. Each map is normalised by its own peak,
  the divisor is written into `public/lightmaps/meta.json`, and `lightmap.ts`
  imports that file directly so the two cannot drift apart. Runtime intensity is
  `scale * LIGHTMAP_EXPOSURE`.
- **`LIGHTMAP_EXPOSURE` is deliberate, not a fudge.** The bake is physically
  right and this room genuinely is dim — one 1.35×1.05m window in a 6.4×4.7m
  plan, and the Cycles preview of the same rig is a dark, moody room. Keep the
  baked *distribution* (that is where the realism is) and lift the level, the
  way games use exposure. Raising the bake's sky strength instead would change
  the ratios between surfaces.
- **`wall_left` and `wall_right` share one material in the GLB**, so
  `applyLightmaps` clones a material per mesh; without that they fight over one
  set of maps and one intensity.
- The bake writes a Cycles preview per set to `/tmp/lm_preview_<set>.png` from
  the app's own `overview` station. Compare it against a browser screenshot to
  tell whether a difference is the bake or the three.js side.

Bake pitfalls that cost real time (all fixed in the script, don't reintroduce):
**`wall_right` has no window hole** — it is a solid 4-vertex plane and the room
is otherwise sealed except at the front, so a world/HDRI lights the interior not
at all and an unsealed front floods it. `apertures()` builds an occluder wall
carrying the real hole just outside it, seals the front, and sets
`wall_right.visible_shadow = False` so light through the hole is not stopped by
the wall it stands in for. **Never cut the hole into `wall_right` itself** — its
UV0 must stay identical to `room.glb` or every baked pixel lands in the wrong
place. Also: `window_glass` is emissive and 12mm from `wall_right`, which blows
that wall to ~100× everything else unless hidden; Blender area lights emit along
local **-Z**, so `R_y(+90)` aims into the room; a source coplanar with a wall is
a singularity; and `wall_left`/`wall_right` share `wall_paint`, so the bake
target node must be re-pointed per *object*, not per material. On Blender 5.x the
sky node's Nishita enum is now `MULTIPLE_SCATTERING` and `dust_density` is
`aerosol_density`.

## Tone mapping

`@react-three/postprocessing`'s `EffectComposer` **forces the renderer to
`NoToneMapping`** and expects tone mapping as a pass. There wasn't one, so
everything above 1.0 hard-clipped. `PostFxEffects.tsx` runs
`<ToneMapping mode={ToneMappingMode.AGX} />` after Bloom, then a
`HueSaturation` + `BrightnessContrast` grade.

AGX because that is what the reference renders use: `layout.blend` is set to
**"AgX - Medium High Contrast" at exposure +0.35**. AgX desaturates as it clips,
which is what keeps a blown window warm instead of white. The *contrast* half of
that look is not part of the transform, so `GRADE` stands in for it — on plain
AgX with no grade the room reads flat and milky.

## Dev helpers (exposed on `window` in dev builds only)

- `__store` — the zustand store. `__store.getState()` for everything; call actions directly.
- `__engine` — the audio engine. Useful: `.rate`, `.getProgress()`, `.needleDown`, `.platterAngle`.
- `__proj(x, y, z)` — projects a world point to client pixel coords via the live camera.
 Use this to compute click targets instead of guessing from screenshots.
- `__intro` — intro visit memory: `.mode()`, `.forget()`, `.lastSeenDaysAgo(n)`, `.seen()`.
- `__lightmap` — `.on()` / `.off()` to A/B the baked room-shell GI.
- `__scene` — the live `THREE.Scene`. Handy with `traverse` for light/material state.

## Driving the app headlessly (browser MCP / CDP)

No browser MCP or dependency is needed for a scripted run: Node 22+ has a global
`WebSocket`, so a plain `.mjs` script can attach to Chrome's DevTools Protocol.
Launch `Google Chrome --headless=new --remote-debugging-port=9333
--enable-unsafe-swiftshader --use-gl=angle --autoplay-policy=no-user-gesture-required`,
read the page target from `http://127.0.0.1:9333/json/list`, then drive `Page`,
`Runtime`, `Input`, `Network` and `Log`. `Input.dispatchMouseEvent` works for real DOM
buttons (the intro's gate and bubble); only r3f objects need the synthetic-event shim
below. `--enable-unsafe-swiftshader` is what lets the WebGL room render headless, and
`--autoplay-policy=no-user-gesture-required` bypasses the gate — which also means a
headless run **cannot** validate real autoplay-blocking behaviour.

When measuring A/V sync, read both `currentTime` values inside a *single*
`Runtime.evaluate` expression; two round trips add their own latency to the delta.



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
p = __proj(0.703, 1.48, -2.13); __click(...p)          // click first cover, top-left (walks to shelf + pulls it out)
// wicker bins: __click(...__proj(0.835, 0.17, -1.78)) toggles the left bin;
// with it open, __click(...__proj(0.835, 0.38, -1.405)) pulls out the bin album
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
11. **ContactShadows are top-down and expensive.** drei's `ContactShadows` re-renders the whole scene every frame from a fixed overhead camera — shadows never sweep with a directional sun, and `frames={Infinity}` causes 50–100ms rAF spikes. Use `directionalLight castShadow` only; `DirectionalLight.target` must be `scene.add(target)`.
12. **GLSL NaNs poison the bloom pass.** One NaN pixel (e.g. `pow(0.0, y)` on
    Metal/ANGLE) spreads through Bloom's mipmap chain and blacks out most of the frame,
    with **no console error**. Symptom: screen mostly black but UI fine, worse from some
    camera angles. Clamp pow bases (`pow(max(x, 1e-4), y)`) in custom shaders.
13. **drei `SoftShadows` (PCSS) is incompatible with three r184** — its shader injection
    still calls `unpackRGBAToDepth` and fails to compile every material. Use
    `VSMShadowMap` for soft area shadows instead (see `ShadowQuality` in `Experience.tsx`).
14. **Raycast diagnosis.** `window.__hits(clientX, clientY)` (dev only) lists the first 8
   intersections at a screen point, nearest first — use it whenever a click "does nothing".
   Note it ignores `visible=false` differences from r3f's raycaster; named meshes
   (`arm-base`, `arm-pivot-column`) read clearest.
15. **`<Canvas shadows>` is the only switch that sticks.** r3f re-applies
 `gl.shadowMap.enabled = !!shadows` from that prop on *every* render of the Canvas
 component, so setting `enabled` in `onCreated` is reverted on the next render and the
 whole scene draws with **no real-time shadows** — silently, with a shadow map still
 allocated so everything looks configured. This was live for a long time and was most of
 why the room read flat. `Experience.tsx` passes `shadows={SHADOW_MAP}` (an object, so
 `type` is left to `ShadowQuality`; a boolean would force `PCFSoftShadowMap`). To check it
 is really running, count `light.shadow.updateMatrices` calls against `scene.onBeforeRender`
 calls over ~1s — they must match. Note `frameloop='demand'` means zero of both when the
 pointer is still, so drive `pointermove` while sampling or you will misread it as broken.
16. **Escape must not highlight UI triggers.** Closing a panel/overlay with Escape returns
   focus to the button that opened it (gear, light dot, etc.), which shows a focus ring or
   looks “stuck” highlighted. On Escape dismiss, call `blurMenuTriggers()` in
   `TopMenuOverlay.tsx`: `requestAnimationFrame` → `.blur()` on `.settings-gear`,
   `.daynight-dot`, and `document.activeElement`. **Defer one frame** so blur runs after the
   browser’s post-unmount focus restore. Apply the same pattern to any new Escape-dismissed
   overlay — never leave the opener focused/highlighted.

## Verification checklist

- `npx tsc --noEmit` — must be clean.
- `npx vite build` — chunk-size warning for three.js is expected; anything else is not.
- In-browser: full flow above; `__engine.getProgress()` advancing; check 60fps with a
  2s `requestAnimationFrame` counter; `window.__errs`-style console capture for errors.
- Dev server usually already running at `http://localhost:5173` — check terminals first.
