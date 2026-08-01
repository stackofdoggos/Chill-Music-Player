# Sound effects credits

Project recordings:
- `sleeve-out.mp3` — pull record from shelf
- `sleeve-in.mp3` — return record to shelf

CC0 samples from [BigSoundBank](https://bigsoundbank.com), processed for this project:
- `needle-drop.mp3` — stylus drop
- `switch-on.mp3` / `switch-off.mp3` — turntable motor
- `vinyl-out.mp3` — vinyl sliding from sleeve
- `crackle-loop.mp3` — groove surface noise
- `hum-loop.mp3` — motor hum

The intro music (`public/loading/yandhi_intro.m4a`) is not a project recording — it is the
audio of the source video the Blender intro was rendered against, fetched with yt-dlp. It is
commercial music from a third-party reupload, so it is fine for local development but is not
cleared for public distribution.

Synthesized for this project:
- `ui-click.wav` — unmute button press (40ms transient + damped 2.1kHz/780Hz body).
  WAV rather than mp3 so no decoder padding sits in front of the attack.

Lid, knob tick, needle lift, and record placement use procedural synthesis in `src/audio/sfx.ts`.
