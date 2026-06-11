# Chill — A Record Room

A Dieter Rams-inspired interactive 3D room for listening to music on a record player.
Pull an album from the 606-style shelf, set it on the Braun SK4-inspired deck, flick the
power switch, and drop the needle. Built with React Three Fiber.

## How it plays

- **Overview** — click the shelf or the player to walk over. `Esc` or clicking the room steps back.
- **Shelf** — click a spine to slide the sleeve out; click the sleeve again to put the record on.
- **Player** — flick the power switch (the platter spins up with a pitch bend), then **drag the
  tonearm** onto the record. Where you drop it is where it plays: outer edge is track 1, inner
  grooves are the end of the album. Drag the arm while playing to seek.
- The **volume knob** drags up/down with stepped detents, the small selector toggles **33 / 45 rpm**
  (45 really does play faster and sharper), the lid lifts on click, and clicking the record
  (needle at rest) sends it back to its sleeve.
- All foley — needle drops, vinyl crackle, sleeve slides, switch clunks, motor hum — is
  synthesized at runtime with the Web Audio API. No sound files.

## Run it

```bash
npm install
npm run fetch-albums   # downloads the album library (requires yt-dlp + ffmpeg)
npm run dev
```

`fetch-albums` pulls track lists and cover art from the iTunes Search API and audio from
YouTube via `yt-dlp`, writing everything into `public/albums/` with an incremental
`manifest.json`. Without it, the shelf shows placeholder sleeves. The downloaded music is
for personal/testing use only.

## Stack

- Vite + React + TypeScript
- three.js via `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`
- `zustand` state, `maath` damped easing
- Custom Web Audio engine (`src/audio/`): media element → vinyl EQ → master gain, with
  crackle/hum layers that follow platter speed, and `preservesPitch = false` for honest
  spin-up/down pitch bends

Everything in the scene is procedural geometry and canvas-generated textures — no GLTF models.
