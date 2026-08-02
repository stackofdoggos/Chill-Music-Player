"""Bake Cycles irradiance for the static room shell into lightmaps.

Runs *inside* Blender against `layout.blend`, via the blender-mcp bridge:

    python3 - <<'EOF'
    import socket, json
    code = open('scripts/bake-lightmaps.py').read()
    s = socket.create_connection(('127.0.0.1', 9876), timeout=1800)
    s.sendall(json.dumps({"type": "execute_code", "params": {"code": code}}).encode())
    print(s.recv(1 << 22).decode())
    EOF

Why this exists
---------------
three.js has no global illumination. The hemisphere/fill/window lights it used
instead add the *same* irradiance everywhere, so the room shell had no window
falloff, no corner darkening and no soft contact shadows — the things that make
a path-traced reference read as three-dimensional.

Only the five shell surfaces are baked: they are the ones that already carry a
clean, non-overlapping 0-1 unwrap on UV0, so no re-export of `room.glb` is
needed. Everything else still uses the real-time rig.

Three sets are baked (`day`, `golden`, `night`) so the app's day-night slider can
cross-fade between them instead of being stuck at one baked condition. Each set
is normalised by its own scale — see `meta.json` and `lightmap.ts`.

What is baked
-------------
`total - sun_direct`, i.e. sky + every bounce, but *not* direct sunlight. The sun
stays real-time so its shadows still sweep with the day phase. Anything that
changes this split must change `Lighting.tsx` to match.

Lighting model
--------------
The world is Blender's Nishita sky (physical atmospheric scattering) with its sun
disc *disabled*, plus a separate SUN lamp aimed to match the app's key light for
that phase. The sky supplies the dome light; the lamp supplies the direct beam
that gets subtracted back out. Driving one `sun_elevation` per set is what makes
the three bakes look like the same room at three times of day rather than three
unrelated lighting setups.

Coordinates
-----------
The app is Y-up, Blender is Z-up: `blender = (app.x, -app.z, app.y)`. Verified
against `window_glass` (Blender x=3.188, y 0.55 centre, z 1.45 centre) matching
the app's rect-area light at (3.17, 1.45, -0.55).

Gotchas that cost real time when this was first written
-------------------------------------------------------
* `wall_right` is a solid plane — there is *no* window hole in the geometry, and
  the room is otherwise a sealed box open only at the front. So a world texture
  lights the interior not at all, and an unsealed front floods it. Both are
  handled here by `apertures()`: an occluder wall carrying the actual hole sits
  just outside `wall_right`, the front is sealed, and `wall_right` is set
  `visible_shadow = False` so light through the hole is not blocked by the very
  wall the occluder is standing in for. Do not "fix" this by cutting a hole in
  `wall_right` itself — its UV0 layout must stay byte-identical to `room.glb` or
  every baked pixel lands in the wrong place.
* `window_glass` has an emissive material and sits 12mm from `wall_right`, which
  blows that wall out to ~100x the rest of the scene. Hide it; the aperture now
  represents the window.
* Blender area lights emit along local -Z. `R_y(+90)` aims that at -X (into the
  room); `R_y(-90)` aims it at +X, straight into the window wall.
* `wall_left` and `wall_right` share the `wall_paint` material, so the bake
  target node must be re-pointed before *each* object, not once per material.
"""

import bpy
import json
import math
import os
import struct
import zlib

import numpy as np
from mathutils import Vector

# --- output ------------------------------------------------------------------
REPO = "/Users/maguilar/Documents/Chill Music Player"
OUT = os.path.join(REPO, "public/lightmaps")

# name -> (width, height); irradiance is very low frequency, so these are small.
TARGETS = [
    ("floor", 1024, 1024),
    ("wall_back", 1024, 512),
    ("wall_left", 1024, 512),
    ("wall_right", 1024, 512),
    ("ceiling", 512, 512),
]

# Room extents, read off the shell meshes. The box is sealed by floor/ceiling/
# wall_left/wall_right/wall_back plus a front seal this script adds.
X0, X1 = -3.2, 3.2
Y0, Y1 = -2.5, 2.2
Z0, Z1 = 0.0, 2.9
# window_glass bounds -> the aperture cut into the occluder wall
WIN_Y0, WIN_Y1 = -0.125, 1.225
WIN_Z0, WIN_Z1 = 0.925, 1.975
OCCLUDER_X = 3.205  # just outside wall_right (3.2); coplanar would be a singularity


def app_to_blender(x, y, z):
    return Vector((x, -z, y))


# Each set: sun elevation drives the Nishita sky; key/target mirror the app's
# keyframe so the real-time sun that replaces the subtracted beam lines up.
SETS = {
    "day": dict(
        sky="nishita",
        elevation=52.0,
        sky_strength=1.0,
        # only the sun's *bounce* survives the subtraction, so this is the main
        # lever on how much warm indirect light fills the room
        sun_energy=7.0,
        sun_color=(1.0, 0.90, 0.78),
        app_key=(2.85, 2.7, 1.1),
        app_target=(-0.7, 0.45, -1.62),
    ),
    "golden": dict(
        sky="nishita",
        elevation=5.0,
        sky_strength=1.0,
        sun_energy=9.0,
        sun_color=(1.0, 0.62, 0.28),
        app_key=(3.1, 1.35, -0.7),
        app_target=(-0.9, 0.45, -1.72),
    ),
    "night": dict(
        # Nishita below the horizon goes essentially black and denoises badly;
        # a dim cool dome is a better stand-in for moon + skyglow.
        sky="flat",
        flat_color=(0.09, 0.13, 0.22),
        sky_strength=0.55,
        sun_energy=0.10,
        sun_color=(0.55, 0.68, 1.0),
        app_key=(-3.2, 2.6, 1.0),
        app_target=(-0.5, 0.0, -1.2),
    ),
}

S = bpy.context.scene
RIG = "LM_RIG"


def quad(bm_name, coll, verts, material=None):
    """A single flat quad from four world-space corners."""
    me = bpy.data.meshes.new(bm_name)
    me.from_pydata([tuple(v) for v in verts], [], [(0, 1, 2, 3)])
    me.update()
    o = bpy.data.objects.new(bm_name, me)
    if material:
        me.materials.append(material)
    coll.objects.link(o)
    return o


def dull_material(name, color):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = 1.0
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.0
    return m


def apertures(coll):
    """Seal the room and give it exactly one hole: the window.

    The occluder is built as four quads framing the window rather than by
    cutting a hole, so there is no boolean to go wrong and the opening is exact.
    """
    grey = dull_material("LM_occluder", (0.35, 0.35, 0.35))
    made = []

    def wall_quad(name, y0, y1, z0, z1):
        made.append(
            quad(
                name,
                coll,
                [
                    (OCCLUDER_X, y0, z0),
                    (OCCLUDER_X, y1, z0),
                    (OCCLUDER_X, y1, z1),
                    (OCCLUDER_X, y0, z1),
                ],
                grey,
            )
        )

    # frame around the aperture, spanning the full wall
    wall_quad("LM_occ_below", -3.5, 3.5, Z0, WIN_Z0)
    wall_quad("LM_occ_above", -3.5, 3.5, WIN_Z1, Z1)
    wall_quad("LM_occ_left", -3.5, WIN_Y0, WIN_Z0, WIN_Z1)
    wall_quad("LM_occ_right", WIN_Y1, 3.5, WIN_Z0, WIN_Z1)

    # the room is open at the front; without this the sky floods in and the
    # window stops being the light source
    made.append(
        quad(
            "LM_occ_front",
            coll,
            [(X0, Y0, Z0), (X1, Y0, Z0), (X1, Y0, Z1), (X0, Y0, Z1)],
            grey,
        )
    )

    # ground outside the window, so incoming light carries a warm upward bounce
    made.append(
        quad(
            "LM_ground",
            coll,
            [(3.2, -12, -0.02), (24, -12, -0.02), (24, 12, -0.02), (3.2, 12, -0.02)],
            dull_material("LM_ground_mat", (0.28, 0.22, 0.15)),
        )
    )
    return made


def world_nodes():
    """Return (background_node, sky_node) with a Nishita sky wired in."""
    nt = S.world.node_tree
    bg = next(n for n in nt.nodes if n.type == "BACKGROUND")
    sky = nt.nodes.get("LM_SKY")
    if sky is None:
        sky = nt.nodes.new("ShaderNodeTexSky")
        sky.name = "LM_SKY"
        sky.location = (-400, 300)
    # Blender 4.5 renamed Nishita to MULTIPLE_SCATTERING; the old enum is gone.
    sky.sky_type = "MULTIPLE_SCATTERING"
    sky.sun_disc = False  # the SUN lamp is the beam; keep it out of the dome
    sky.altitude = 0.0
    sky.air_density = 1.0
    sky.aerosol_density = 1.6  # a little haze warms the low-sun sets
    sky.ozone_density = 1.0
    # LM_ground is a real plane doing the bounce through the aperture, so keep
    # the sky model's own ground term low or the two count the same light twice
    sky.ground_albedo = 0.1
    return bg, sky


def configure_world(bg, sky, cfg):
    nt = S.world.node_tree
    for link in list(nt.links):
        if link.to_node is bg and link.to_socket is bg.inputs[0]:
            nt.links.remove(link)
    if cfg["sky"] == "nishita":
        sky.sun_elevation = math.radians(cfg["elevation"])
        sky.sun_rotation = cfg["_azimuth"]
        nt.links.new(sky.outputs[0], bg.inputs[0])
    else:
        bg.inputs[0].default_value = (*cfg["flat_color"], 1.0)
    bg.inputs[1].default_value = cfg["sky_strength"]


def preview(set_name):
    """Cycles render from the app's `overview` station.

    This is the ground truth the runtime is trying to approximate — it shows the
    same lighting rig with real GI, so comparing it against a browser screenshot
    says whether a difference is the bake or the three.js side.
    """
    cam = bpy.data.objects.get("LM_preview_cam")
    if cam is None:
        cd = bpy.data.cameras.new("LM_preview_cam")
        cd.lens_unit = "FOV"
        cd.angle_y = math.radians(40)  # app camera is fov 40 (vertical)
        cam = bpy.data.objects.new("LM_preview_cam", cd)
        bpy.data.collections[RIG].objects.link(cam)
    pos = app_to_blender(0.25, 1.36, 1.55)
    tgt = app_to_blender(0.1, 0.98, -2.0)
    cam.location = pos
    cam.rotation_euler = (tgt - pos).to_track_quat("-Z", "Y").to_euler()
    S.camera = cam
    S.render.resolution_x, S.render.resolution_y = 960, 540
    S.render.resolution_percentage = 100
    S.render.image_settings.file_format = "PNG"
    S.render.filepath = f"/tmp/lm_preview_{set_name}.png"
    prev_samples = S.cycles.samples
    S.cycles.samples = 96
    bpy.ops.render.render(write_still=True)
    S.cycles.samples = prev_samples


def write_png(path, rgb8):
    h, w, _ = rgb8.shape
    raw = b"".join(b"\x00" + rgb8[y].tobytes() for y in range(h))

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    open(path, "wb").write(png)


def main():
    os.makedirs(OUT, exist_ok=True)

    coll = bpy.data.collections.get(RIG)
    if coll:
        for o in list(coll.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.collections.remove(coll)
    coll = bpy.data.collections.new(RIG)
    S.collection.children.link(coll)

    apertures(coll)

    sd = bpy.data.lights.new("LM_sun_data", "SUN")
    sd.angle = math.radians(2.5)
    sun = bpy.data.objects.new("LM_sun", sd)
    coll.objects.link(sun)

    glass = bpy.data.objects["window_glass"]
    glass.hide_render = True
    wall_right = bpy.data.objects["wall_right"]
    prev_shadow = wall_right.visible_shadow
    # light through the aperture must not be stopped by the wall it stands in for
    wall_right.visible_shadow = False

    bg, sky = world_nodes()

    S.render.engine = "CYCLES"
    S.cycles.device = "GPU"
    S.cycles.samples = 256
    S.cycles.use_denoising = True
    S.render.bake.margin = 24
    S.render.bake.use_clear = True
    S.render.bake.use_selected_to_active = False

    def target_node(mat, img):
        nt = mat.node_tree
        n = nt.nodes.get("LM_BAKE_TGT") or nt.nodes.new("ShaderNodeTexImage")
        n.name, n.image, n.location = "LM_BAKE_TGT", img, (-900, 600)
        for x in nt.nodes:
            x.select = False
        n.select = True
        nt.nodes.active = n

    def bake(name, w, h, tag, direct, indirect, sun_on, sky_strength):
        img = bpy.data.images.get(f"LM_{name}_{tag}")
        if img:
            bpy.data.images.remove(img)
        img = bpy.data.images.new(
            f"LM_{name}_{tag}", width=w, height=h, alpha=False, float_buffer=True
        )
        img.colorspace_settings.name = "Non-Color"
        target_node(bpy.data.objects[name].data.materials[0], img)
        sun.hide_render = not sun_on
        bg.inputs[1].default_value = sky_strength
        S.render.bake.use_pass_direct = direct
        S.render.bake.use_pass_indirect = indirect
        S.render.bake.use_pass_color = False
        bpy.ops.object.bake(type="DIFFUSE")
        buf = np.zeros(len(img.pixels), dtype=np.float32)
        img.pixels.foreach_get(buf)
        bpy.data.images.remove(img)
        return buf.reshape(h, w, 4)[:, :, :3]

    report = {"sets": {}}

    for set_name, cfg in SETS.items():
        kp = app_to_blender(*cfg["app_key"])
        kt = app_to_blender(*cfg["app_target"])
        to_sun = (kp - kt).normalized()
        cfg["_azimuth"] = math.atan2(to_sun.y, to_sun.x)
        sun.rotation_euler = (kt - kp).to_track_quat("-Z", "Y").to_euler()
        sd.energy = cfg["sun_energy"]
        sd.color = cfg["sun_color"]
        configure_world(bg, sky, cfg)

        planes = {}
        for name, w, h in TARGETS:
            o = bpy.data.objects[name]
            bpy.ops.object.select_all(action="DESELECT")
            o.select_set(True)
            bpy.context.view_layer.objects.active = o
            total = bake(name, w, h, "total", True, True, True, cfg["sky_strength"])
            sundir = bake(name, w, h, "sundir", True, False, True, 0.0)
            # blender's pixel buffer is bottom-up
            planes[name] = np.flipud(np.clip(total - sundir, 0.0, None))

        maps = {}
        for name, lm in planes.items():
            # Scale is per *map*, not per set. One small window means the wall
            # facing it and the wall beside it differ by ~50x in irradiance, so
            # a shared scale left wall_back quantised to about seven 8-bit codes.
            # Each surface now spends its full 8 bits on its own range and
            # carries its own lightMapIntensity at runtime.
            peak = float(lm.max())
            scale = max(0.05, math.ceil(peak * 100.0) / 100.0)
            v = np.clip(lm / scale, 0.0, 1.0)
            srgb = np.where(v <= 0.0031308, v * 12.92, 1.055 * v ** (1 / 2.4) - 0.055)
            write_png(
                os.path.join(OUT, f"{set_name}_{name}.png"),
                (srgb * 255).astype(np.uint8),
            )
            maps[name] = {
                "scale": scale,
                "size": list(lm.shape[1::-1]),
                "max": round(peak, 3),
                "mean": round(float(lm.mean()), 4),
            }
        report["sets"][set_name] = {"maps": maps}
        # the last sundir bake left the sky at 0 and is why previews came out
        # black the first time; restore the set's real world before rendering
        configure_world(bg, sky, cfg)
        sun.hide_render = False
        preview(set_name)
        print(f"baked {set_name}: " + ", ".join(f"{k}={v['scale']}" for k, v in maps.items()))

    # restore
    sun.hide_render = False
    glass.hide_render = False
    wall_right.visible_shadow = prev_shadow
    for o in list(coll.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.collections.remove(coll)

    json.dump(report, open(os.path.join(OUT, "meta.json"), "w"), indent=1)
    print(json.dumps(report, indent=1))


main()
