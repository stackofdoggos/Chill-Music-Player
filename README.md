# Chill — A Record Room

A Dieter Rams-inspired interactive 3D room for listening to music on a record player. Pull an
album from the 606-style shelf, set it on the Braun SK4-inspired deck, flick the power switch,
and drop the needle. Built with React Three Fiber.

Live deploy: [milesaguilar.com/music](https://milesaguilar.com/music)

## How it plays

- **Overview** — click the shelf or the player to walk over. `Esc` or clicking the room steps back.
- **Shelf** — click a spine to slide the sleeve out. `F` flips the sleeve; `P` puts it back, selects
  the hovered spine, or swaps while inspecting (when `view === 'shelf'`).
- **Player** — flick the power switch (the platter spins up with a pitch bend), then **drag the
  tonearm** onto the record. Where you drop it is where it plays: outer edge is track 1, inner
  grooves are the end of the album. Drag the arm while playing to seek.
- **Volume knob** — drag or arrow keys in close-up view. **33 / 45** selector changes real playback
  speed. The lid lifts on click. Click the record (needle at rest) to send it back to its sleeve.
- **Views** — `overview | shelf | player | volume | arm | art` (painting close-up on the back wall).

Audio requires clicking **Enter — sound on** on the loading screen (browser gesture gate).

## Audio

- **Music** — HTML `<audio>` through a vinyl EQ chain (`lowshelf` warmth + `highshelf` rolloff).
  `preservesPitch = false` so spin-up/down bends pitch like a real motor.
- **Groove crackle** — looping sample (`public/sfx/crackle-loop.mp3`), gain follows platter `rate`.
- **Foley** — mix of sampled CC0/processed sounds in `public/sfx/` plus procedural one-shots in
  `src/audio/sfx.ts` (needle lift, knob tick, lid, record place). See `public/sfx/CREDITS.md`.
- **No API keys** — the running app only loads static files from your server. Album fetching is a
  local dev script, not part of the deployed bundle.

## Day–night lighting (dev)

A keyframed 0–1 cycle drives window sun position, wall tints, bloom, vignette, and
`scene.environmentIntensity`. Defaults to golden hour (`dayPhase` 0.65 in the store).

The **Light** slider (bottom-right, dev UI) scrubs the cycle. Remove `DayNightSlider` from
`App.tsx` before a public release if you do not want it live.

Shadows come from a **spotlight** through the right-hand window (`src/scene/Lighting.tsx`). Do not
use drei's `ContactShadows` with `frames={Infinity}` — it renders top-down every frame (slow) and
does not follow the sun.

## Favicon

`src/ui/Favicon.tsx` draws a generic vinyl disc to the tab icon. It rotates only while music is
actually playing (`engine.isPlaying()`).

## Project layout

| Path | Role |
| --- | --- |
| `src/state/store.ts` | zustand: views, shelf/record phases, power, needle, volume, speed, `dayPhase` |
| `src/scene/layout.ts` | World coordinates, camera stations, tonearm ↔ groove ↔ progress math |
| `src/scene/dayNight.ts` | Atmosphere keyframes + `sampleAtmosphere(phase)` |
| `src/scene/Lighting.tsx` | Sun spotlight, fill, interior lamp, static Environment reflections |
| `src/audio/engine.ts` | Singleton engine: platter physics, crackle, SFX, needle drop/seek |
| `src/albums.ts` | Loads `manifest.json`, resolves track/cover URLs via `assetUrl()` |
| `src/assetUrl.ts` | Prefixes paths with Vite `base` (`/music/` in production) |
| `public/albums/` | Downloaded audio, covers, `manifest.json` |
| `public/sfx/` | Foley samples |
| `scripts/fetch-albums.mjs` | yt-dlp + iTunes pipeline (dev only) |
| `scripts/check-deploy.mjs` | Scans `dist/` for secrets before upload |

Procedural geometry and canvas textures throughout — no GLTF models. See `AGENTS.md` for debugging
pitfalls, dev helpers (`__store`, `__engine`, `__proj`), and automation notes.

## Local development

```bash
npm install
npm run fetch-albums   # optional: requires yt-dlp, ffmpeg, node for yt-dlp JS runtime
npm run dev            # http://localhost:5173/
```

`fetch-albums` pulls track lists and artwork from the **iTunes Search API** and audio from
**YouTube** via `yt-dlp`, writing into `public/albums/` with an incremental `manifest.json`.
Without it, the shelf shows placeholder sleeves. **Downloaded music is for personal/testing use
only** — do not redistribute without rights you control.

After editing `store.ts` or `engine.ts`, **reload the page** (HMR orphans singletons).

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server (`base: /`) |
| `npm run build` | Typecheck + production build (`base: /music/`) |
| `npm run preview` | Preview `dist/` at site root |
| `npm run preview:music` | Preview at `/music/` (matches production paths) |
| `npm run check-deploy` | Scan `dist/` for keys, tokens, dev globals |
| `npm run fetch-albums` | Build/update `public/albums/` |

## Deploy (Namecheap / static hosting)

Production builds target **`/music/`** on the host (see `vite.config.ts`). Local dev uses `/`.

### Build and verify

```bash
npm run build
npm run check-deploy   # must print "deploy check passed"
```

Output is in `dist/` (~550 MB with full album library — mostly audio). No source maps, no env
files, no dev globals in the bundle.

### Upload to Namecheap (cPanel)

1. cPanel → **File Manager** → `public_html`
2. Upload and extract a zip whose contents include `music/index.html`, **or** upload `dist/*`
   into `public_html/music/`
3. Visit `https://milesaguilar.com/music/`

Step-by-step copy lives in `DEPLOY-NAMECHEAP.txt`.

If cPanel rejects the upload size (~495 MB zipped), use **FTP/SFTP** to `public_html/music/`.

### Create a deploy zip

```bash
npm run build && npm run check-deploy
mkdir -p .deploy-staging/music
rsync -a --delete dist/ .deploy-staging/music/
cp DEPLOY-NAMECHEAP.txt .deploy-staging/DEPLOY.txt
cd .deploy-staging && zip -r ../music-deploy.zip DEPLOY.txt music
cd .. && rm -rf .deploy-staging
```

`music-deploy.zip` is gitignored. Extract in `public_html` so you get `public_html/music/`.

### Server fallback (SPA)

Single page at `/music/` — if the host needs a rewrite rule:

**nginx**

```nginx
location /music/ {
  try_files $uri $uri/ /music/index.html;
}
```

**Apache** (`public_html/music/.htaccess`)

```apache
RewriteEngine On
RewriteBase /music/
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /music/index.html [L]
```

HTTPS is required for reliable audio playback.

## Stack

- Vite 8 + React 19 + TypeScript
- three.js via `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`
- zustand, maath (damped camera)

## License / content

Album audio in `public/albums/` is fetched from third-party sources for personal use. Sound
effect credits: `public/sfx/CREDITS.md`. Wall art: de Hooch (see `public/art/`).
