# Shelf Visual Audit — Reference vs. Implementation

**Purpose:** Compare the target reference (warm-minimalist walnut bookcase + microcement wall) against the current Chill Music Player shelf view, diagnose why the live scene reads as **flat / bland / CG**, and outline fixes **without prescribing immediate code changes**.

**Assets compared:**
- **Reference:** Editorial / architectural visualization — dark walnut freestanding shelf, lime-wash or microcement wall, window light from the left, vinyl + wicker baskets, plant and framed art in periphery.
- **Implementation:** In-engine screenshot (~golden hour / late afternoon), same general layout (4-tier shelf, spine row, wicker bins, back-wall art), captured from the `shelf` camera station in `layout.ts`.

---

## 1. Executive summary

The reference image feels **photographic** because it stacks many small, independent cues: **material depth** (normal + roughness variation), **directional light with falloff**, **contact shadow**, **color restraint on neutrals**, and **micro-imperfection** (bevels, plank variation, record lean). None of these are single “hero” features — they accumulate.

The implementation has the **correct macro-composition** (geometry placement, album interaction, baskets, art) but reads bland because:

1. **Shelf wood PBR is incomplete and inconsistently mapped** — vertical faces lack normal maps; UV scale/direction were never finished after a botched Blender pass.
2. **Post-processing eats detail at warm light phases** — bloom threshold drops to ~0.42 and intensity peaks at ~0.58 during golden hour, while a default softness pass blurs fine grain; together they **homogenize** contrast that wood relies on.
3. **Lighting is multi-source and relatively flat on the shelf volume** — hemisphere + fill + rect window + spotlight + volumetric shafts compete instead of producing one dominant window key with deep shelf self-shadowing.
4. **Neutrals (wall + wood) were pushed warm in the day-night curve** — even after recent microcement fixes, window emissive and key light colors still **orange-tint the whole frame**, making texture mottling harder to read.
5. **Resolution and temporal smoothing reduce texture fidelity exactly when the scene is warmest** — `effectiveDpr()` lerps toward 1× during haze/golden hour; temporal blend + softness further soften an already low-contrast material.

The gap is less “wrong shelf model” and more **missing the last 20% of material + light + post discipline** that separates a clean real-time scene from a styled interior photograph.

---

## 2. Reference image — what makes it work

### 2.1 Bookshelf wood

| Cue | What you see | Why it matters |
| --- | --- | --- |
| **Open-pore grain** | Dark walnut/oak with visible pores running along plank direction | Breaks up large flat faces; eye reads “solid timber” not “brown plane” |
| **Finish** | Matte-to-satin — not mirror-gloss, not dead-flat | Specular peaks on grain ridges sell thickness |
| **Panel thickness** | ~2–3″ sides and shelves feel heavy | Shadow gradients on front edges + underside give mass |
| **Edge treatment** | Slight bevel/chamfer catches **rim light** | Without this, boxes look like CSG primitives |
| **Plank variation** | Subtle tone shift board-to-board | Prevents obvious texture tiling |
| **Interior contrast** | Left face of unit bright; right face and shelf undersides fall into soft shadow | Defines volume |

### 2.2 Wall (microcement / lime wash)

| Cue | What you see | Why it matters |
| --- | --- | --- |
| **Trowel mottling** | Cream ↔ taupe variation, not flat paint | High-frequency detail keeps background alive |
| **Neutral under warm light** | Wall stays **earthy gray**, not orange | Warm sun hits the room; plaster **does not** become peach |
| **Soft shelf shadow** | Elongated contact shadow on wall behind/right | Grounds object; adds depth layering |

### 2.3 Lighting

| Cue | What you see | Why it matters |
| --- | --- | --- |
| **Single dominant key** | Large off-camera window left | Clear light direction → readable form |
| **Contact AO** | Deep soft shading where records meet shelf, shelf meets wall | “Expensive” look; objects feel seated |
| **Specular response** | Gloss on record sleeves; satin on wood; matte on wall | Material **differentiation** |
| **No highlight blowout** | Bloom/haze not obvious in still | Micro-detail survives in lit areas |

### 2.4 Content & styling

- **Forward-facing covers** on top rows with real artwork color variety.
- **Spine row** = rhythmic thin vertical stripes (many hues).
- **Wicker** = high-frequency organic contrast against smooth wood.
- **Peripheral depth** — plant (slight blur), rug edge, framed print — frames the hero shelf.

---

## 3. Current implementation — inventory

### 3.1 Geometry & scene graph

| Item | Source | Notes |
| --- | --- | --- |
| Shelf carcass | `public/models/room.glb` | Meshes: `shelf_side_L/R`, `shelf_back`, `shelf_board_0–2`, `shelf_top`, `shelf_foot_*` |
| Interactive sleeves | `src/scene/Shelf/AlbumSleeve.tsx` | Canvas-drawn cover art; runtime meshes |
| Decorative spines | GLB `spine_*` meshes | Flat colors from deterministic palette in `Shelf.tsx` |
| Wicker bins | `BasketShell.tsx` + GLB anchors | Runtime wicker PBR (`wicker_diff/nor/rough`) — **this part is comparatively strong** |
| Wall | `SceneModel.tsx` | Runtime microcement maps (`wall_diff/nor/rough`) on all three walls (recent) |
| Desk wood (contrast) | `DeskTop.tsx` | Full walnut PBR with `normalScale` 0.65 — **shelf does not get equivalent treatment** |

### 3.2 Shelf materials (from GLB export)

| Mesh group | Material | Normal map | Roughness |
| --- | --- | --- | --- |
| Vertical panels (`shelf_side_*`, `shelf_back`) | `walnut_v.001` | **None** | Undefined (exporter default) |
| Horizontal boards + top | `walnut_h.001` | **Yes** (embedded) | Undefined |
| Feet | `shelf_foot.001` | None | Flat color |

**Implication:** Standing in the shelf view, the **two largest visible wood surfaces** (side panels + back) render as **flat diffuse** with stretched or generic UVs, while only horizontal boards get pore depth. The desk right next to it can look richer because `DeskTop.tsx` applies all three maps deliberately.

Walnut source: Poly Haven “Dark Wood” 2K (`public/textures/walnut_*`) — good asset, **under-applied** on shelf.

### 3.3 UV / texture mapping state

- Shelf UVs were flagged as problematic (cube projection at 0.42 m tile attempted in Blender; geometry rotation mistake rolled back).
- Current GLB is pre-UV-fix geometry with **original unwrap** — likely uniform cube wrap causing **streaky / smeared grain** on thin edges and inconsistent scale on 1.19 m × 1.69 m panels.
- No runtime override in `SceneModel.tsx` for shelf (unlike floor, walls, desk).

### 3.4 Lighting stack (`Lighting.tsx` + `dayNight.ts`)

| Light | Role | Shelf impact |
| --- | --- | --- |
| `hemisphereLight` | Sky/ground ambient | Lifts shadow floor — reduces interior contrast |
| `spotLight` (sun) | Shadow-casting key | Moves with day phase; penumbra 0.45 |
| `directionalLight` (fill) | Secondary from `-2, 1.8, 2.2` | **Flattens** shelf cavity shadows |
| `rectAreaLight` (window) | Warm area source at right wall | Strong at golden hour (`windowEmissiveIntensity` up to ~1.65) |
| `pointLight` (lamp) | Near player | Adds warm pool away from shelf |
| HDRI (`aft_lounge_1k.exr`) | IBL when reflections on | Scaled ×0.22 — subtle |

Golden hour keyframe sample (`dayNight.ts` t≈0.65):
- `keyColor: #ff9838`, `keyIntensity: 2.35`
- `windowEmissive: #ffb040`, intensity `1.65`
- `bloomIntensity: 0.58`, `bloomThreshold: 0.42`

The screenshot timing matches this phase — **maximum warmth + maximum bloom**.

### 3.5 Post-processing (`PostFxEffects.tsx` + defaults)

| Effect | Default / behavior | Blandness risk |
| --- | --- | --- |
| **Bloom** | Atmosphere-driven; low threshold at sunset | **Clips wood specular and sleeve gloss into haze** |
| **Softness** | 0.22 opacity, radius 0.75; ×⅓ in auto resolution | Blurs fine grain and wicker detail |
| **Temporal blend** | 0.02 | Smears micro-contrast frame-to-frame |
| **Grain** | 0.35 screen noise | Adds film but not surface relief |
| **N8AO** | Optional; half-res; intensity 2.6 | Helps globally but **not** a substitute for mesh contact shadows on thick shelf boards |
| **Vignette** | Strong at warm phases | Darkens periphery but doesn’t add local shelf contrast |

### 3.6 Resolution & performance choices

- `effectiveDpr()` → **1× DPR** at golden hour/sunset in `auto` mode (by design, for GPU).
- 45 fps demand frameloop cap.
- These are correct for performance but **directly reduce** the reference’s crisp pore detail at the exact mood users screenshot.

---

## 4. Side-by-side comparison

### 4.1 Materials & textures

| Dimension | Reference | Implementation | Delta |
| --- | --- | --- | --- |
| Wood normal detail | Strong on all faces | Vertical shelf: **none**; horizontal: yes | **Major** — sides look like flat brown |
| Roughness variation | Pores dull, ridges slightly shiny | Mostly default / single value | **Moderate** — uniform sheen |
| UV scale | Plank repeats believable (~real meters) | Streaky / smeared on edges; tiling visible on legs | **Major** |
| Edge bevels | Catch rim highlights | Sharp GLB edges — minimal glint | **Moderate** |
| Wall | Microcement mottling, neutral | Microcement maps added; warm tint + bloom still dominate | **Improving but not reference-level** |
| Wicker | Deep weave shadow | Runtime PBR — decent | **Small gap** |
| Record sleeves | Glossy print, color pop | Canvas art — matte, less specular | **Moderate** |
| Spine row | Many hues, tight packing | Deterministic palette — OK but uniform height/depth | **Moderate** |

### 4.2 Lighting & atmosphere

| Dimension | Reference | Implementation | Delta |
| --- | --- | --- | --- |
| Key light direction | Clear left window | Split between spot + rect + fill | **Moderate** — muddier form read |
| Shelf interior shadow | Deep, soft | Lifted by hemi + fill | **Major** — “floating records” feel |
| Contact shadow on wall | Visible elongated shadow | Present but weak vs bloom | **Moderate** |
| Wall color under sun | Neutral plaster | Historically orange; now muted but light still warm | **Moderate** |
| Specular on wood | Visible satin | Weak without normals + blown by bloom | **Major** |
| Depth of field | Subtle | None | Minor stylistic gap |

### 4.3 Image processing

| Dimension | Reference | Implementation | Delta |
| --- | --- | --- | --- |
| Highlight rolloff | Soft, detail retained | Bloom threshold 0.42 — **detail lost** | **Major** |
| Local contrast | High on wood grain | Softness + temporal reduce | **Major** |
| Noise / grain | Film grain optional | Screen grain 0.35 — different purpose | Neutral |
| Overall saturation | Restrained neutrals, punchy accents | Global warm cast | **Moderate** |

---

## 5. Why the implementation looks bland — root causes (ranked)

### 5.1 🔴 Critical — incomplete wood PBR on the faces you actually see

In the shelf camera (`STATIONS.shelf`), the **vertical walnut panels** dominate the frame. They use `walnut_v.001` with **no normal map**. Photographic wood relies on micro-shadows in pores; diffuse-only reads as **cardboard**.

**Fix direction:** Apply `walnut_diff / walnut_nor / walnut_rough` to **all** shelf meshes at a consistent world scale (mirror `DeskTop.tsx` logic), either in Blender export or runtime in `SceneModel.tsx`. Target ~1.2 repeats per meter. Ensure vertical grain on sides via UV rotation (bmesh UV rotate — **never** edit-mode mesh rotate).

### 5.2 🔴 Critical — bloom + softness at golden hour

At the phase shown in the screenshot, `bloomThreshold` drops to **0.42** while intensity hits **0.58**. Wood grain highlights and sleeve edges exceed that threshold and **fuse into a warm glow**. Combined with default **softness 0.22** (and ×⅓ in auto, still non-zero), the scene loses the high-frequency contrast the reference keeps.

**Fix direction:**
- Raise bloom threshold on interior materials / globally during shelf view (e.g. threshold ≥ 0.75 at golden hour).
- Reduce bloom intensity on wood-dominant views or tie bloom primarily to window emissive, not whole frame.
- Lower softness when `view === 'shelf'` or when camera distance to shelf < X.
- Consider **material-aware bloom** (exclude shelf layer) if available.

### 5.3 🟠 High — flat lighting in the shelf cavity

Reference = one strong window key + deep cavity AO. Implementation = sun spot + **fill directional** + hemisphere + rect window. Fill and hemi **raise the shadow floor** inside shelves where records need separation.

**Fix direction:**
- Reduce fill intensity when camera targets shelf (or globally reduce fill vs key ratio at golden hour).
- Bias rect area light to **wrap** without overpowering key; current intensity formula `windowEmissiveIntensity * 1.9 + hemi * 0.6` is aggressive.
- Ensure sun target/key framing puts **left-bright / right-dark** gradient across shelf (reference composition).
- Mesh **contact shadows** or baked AO on shelf underside / back panel (lightmap or vertex AO in Blender) — SS AO alone won’t darken tight record gaps convincingly.

### 5.4 🟠 High — UV mapping & visible repetition

Bad cube UVs produce **long horizontal streaks** on vertical faces and **smear** on thin edges. Even perfect PBR maps look wrong. Duplicate Beethoven covers on top shelf (content) also break illusion of a curated collection.

**Fix direction:**
- Finish Blender UV pass: cube project at real-world scale; separate **edge faces** to end-grain material (dark solid) to avoid stretched grain on 18 mm edges.
- Per-board slight UV offset / color variation for top boards.
- Replace duplicate placeholder art with unique covers (content pipeline, not rendering).

### 5.5 🟡 Medium — missing satin clearcoat on finished wood

Reference wood has a **subtle lacquer sheen**. `DeskTop` uses `MeshStandardMaterial` with roughness map only. Shelf GLB is standard material without clearcoat. Player chassis uses `MeshPhysicalMaterial` clearcoat — shelf could share a lighter variant.

**Fix direction:** `MeshPhysicalMaterial` with clearcoat ~0.15–0.35, clearcoatRoughness ~0.4 on shelf boards only — not full piano gloss.

### 5.6 🟡 Medium — warm light pollutes neutrals

Even with cooler `wallColor` keyframes, **key light** (`#ff9838`) and **window emissive** (`#ffb040`) still bathe wood and wall in saturated orange. Real microcement stays gray; wood darkens but doesn’t turn amber.

**Fix direction:**
- Desaturate key/fill/window colors at golden hour for **interior-facing lights** while keeping visible sun disk outside warm.
- Separate “exterior sky warmth” from “interior bounce color” in `dayNight.ts` (e.g. `interiorBounceColor` vs `exteriorSunColor`).

### 5.7 🟡 Medium — DPR / softness tradeoff at the wrong moment

Auto mode drops to 1× DPR when `hazeBlend()` peaks — exactly golden hour. Users evaluating “quality” at sunset see the **softest, lowest-res** version.

**Fix direction:** Decouple haze DPR from aesthetic evaluation — e.g. cap softness by DPR, or don’t reduce DPR in `shelf`/`art` views where texture detail matters.

### 5.8 🟢 Lower — stylistic & content polish

| Item | Notes |
| --- | --- |
| Depth of field | Subtle DOF on shelf view would mimic reference lens |
| Record sleeve specular | Thin clearcoat or anisotropy on sleeves |
| Spine variation | Slight random lean, height jitter (already partial in baskets) |
| Plant / props | Reference plant adds foreground parallax; ensure not bloom-blown |
| Shadow quality | VSM soft shadows help but can blur contact detail — tune radius |

---

## 6. Hypothesis checklist — “bland” diagnostic

Use this when A/B testing fixes:

- [ ] Do vertical shelf panels show visible pores at arm’s length?
- [ ] Does disabling bloom (dev) immediately increase “3D-ness”?
- [ ] Does disabling softness reveal grain that was missing?
- [ ] With fill light removed, do records separate from back panel?
- [ ] At 2× DPR, does wood still look flat (→ material) or just soft (→ post/res)?
- [ ] Does desk wood look better than shelf wood from same angle (→ confirms shelf-specific PBR gap)?
- [ ] Does wall read stone-gray at sunset without orange cast?

---

## 7. Proposed fix plan (phased, no code here)

### Phase A — Materials (highest ROI)

1. **Unified shelf walnut PBR** — all shelf meshes, all three maps, consistent world repeat.
2. **Blender UV finalize** — correct scale, vertical grain on sides, edge material for thin faces.
3. **Optional baked cavity AO** — shelf interior + back panel in GLB (second UV channel or vertex colors).

**Verify:** Shelf view at **day** phase, bloom off, AO on — should already look 2× better.

### Phase B — Lighting discipline

1. Rebalance golden hour: lower fill, desaturate interior key, keep window warm but not emissive-strength 1.65 on rect light.
2. Aim sun/key for left→right brightness gradient across shelf.
3. Tune N8AO or add baked AO for record-row contact.

**Verify:** Shadow under top board lip visible; records cast soft shadows on board below.

### Phase C — Post-processing guardrails

1. Raise bloom threshold floor (e.g. min 0.65 except explicit “dreamy sunset” mode).
2. Reduce softness in shelf/overview views or tie to settings “Interior clarity”.
3. Review temporal blend impact on static shelf framing.

**Verify:** Golden hour screenshot retains wood pore detail in highlights.

### Phase D — Polish

1. Light clearcoat on wood + sleeve gloss.
2. Per-board color jitter; unique top-shelf art.
3. Optional subtle DOF on shelf camera.

---

## 8. What *not* to chase

| Temptation | Why skip (for now) |
| --- | --- |
| Replace entire shelf model | Geometry is fine; material/light/post are the bottleneck |
| 4K textures only | 2K Poly Haven walnut is enough if UVs + normals are correct |
| Ray-traced GI | Performance budget; fix direct lighting + baked AO first |
| More orange sunset | Reference succeeds because **walls stay neutral** — lean cooler |

---

## 9. File map for implementers

| Concern | Primary files |
| --- | --- |
| Shelf geometry & materials | `public/models/room.glb`, Blender `layout.blend` |
| Runtime wall microcement | `src/scene/SceneModel.tsx` |
| Desk wood (reference implementation) | `src/scene/DeskTop.tsx` |
| Wicker (working PBR example) | `src/scene/Shelf/BasketShell.tsx`, `Shelf.tsx` |
| Day/night colors & bloom | `src/scene/dayNight.ts` |
| Lights | `src/scene/Lighting.tsx` |
| Post stack | `src/scene/PostFxEffects.tsx`, `src/state/postFx.ts` |
| DPR / haze | `src/scene/dayNight.ts` → `effectiveDpr()`, `hazeBlend()` |
| Camera | `src/scene/layout.ts` → `STATIONS.shelf` |
| Texture assets | `public/textures/walnut_*`, `wall_*`, `wicker_*` |

---

## 10. Closing contrast — one sentence each

**Reference:** A styled photograph where **neutral plaster**, **directional window light**, and **complete wood PBR** cooperate; post-processing (if any) is invisible.

**Implementation:** A correct layout running **warm multi-light + aggressive bloom/softness** on **half-complete shelf materials**, at **reduced resolution** during the warmest mood — so the eye sees **color** but not **surface**.

Closing the gap is mostly **finish work**: same assets, stricter light/post discipline, and giving the shelf the same material respect the desk already gets.
