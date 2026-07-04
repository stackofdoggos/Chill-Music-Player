import { useMemo, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { easing } from "maath";
import { dragActiveOrRecent, useStore } from "../../state/store";
import { engine } from "../../audio/engine";
import { BASKET, DISPLAY_SLOTS, SHELF, SHELF_BACK_INNER_Z, SLEEVE } from "../layout";
import { AlbumSleeve } from "./AlbumSleeve";
import { BasketShell } from "./BasketShell";

/** deterministic PRNG so the decorative records never reshuffle */
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SPINE_PALETTE = [
  "#8a8074", "#6b5d4f", "#3e3a36", "#a39482", "#5c6470", "#7d6b5a",
  "#494540", "#94867a", "#665d52", "#8f7f6e", "#3a4350", "#7a4a3a",
  "#b0a390", "#55503f", "#274a43", "#8c3b2e",
];

/**
 * Wrap-lighting translucency (fake SSS) for the plant leaves: light from
 * behind bleeds through thin geometry with a warm-green tint. Injected into
 * MeshStandardMaterial so tone mapping/env lighting still apply.
 */
function makeLeafMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color: "#4a6b4f", roughness: 0.7 });
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <lights_fragment_end>",
      /* glsl */ `
      #include <lights_fragment_end>
      {
        // translucency: view-dependent backlight bleeding through the leaf
        #if NUM_SPOT_LIGHTS > 0
        vec3 sssLightDir = normalize(spotLights[0].position - geometryPosition);
        vec3 sssHalf = normalize(sssLightDir + geometryNormal * 0.35);
        float sssDot = pow(clamp(dot(geometryViewDir, -sssHalf), 0.0, 1.0), 2.2);
        vec3 sssColor = vec3(0.55, 0.85, 0.35) * sssDot * 0.6;
        reflectedLight.directDiffuse += sssColor * spotLights[0].color;
        #endif
      }
      `,
    );
  };
  return mat;
}

function Plant({ position, onClick }: { position: [number, number, number]; onClick: (e: ThreeEvent<MouseEvent>) => void }) {
  const leaves = [
    { r: 0, h: 0.22, lean: 0.05 },
    { r: 1.2, h: 0.27, lean: 0.12 },
    { r: 2.4, h: 0.19, lean: -0.1 },
    { r: 3.8, h: 0.25, lean: 0.08 },
    { r: 5.0, h: 0.21, lean: -0.14 },
  ];
  const leafMat = useMemo(makeLeafMaterial, []);
  return (
    <group position={position}>
      <mesh castShadow onClick={onClick}>
        <cylinderGeometry args={[0.045, 0.035, 0.07, 24]} />
        <meshStandardMaterial color="#e8e5df" roughness={0.8} />
      </mesh>
      {leaves.map((l, i) => (
        <group key={i} rotation-y={l.r} position-y={0.03}>
          <mesh position-y={l.h / 2} rotation-x={l.lean} material={leafMat} castShadow onClick={onClick}>
            <coneGeometry args={[0.016, l.h, 6]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** dense row of decorative record spines packed on the middle shelf */
function SpineRow({ onClick }: { onClick: (e: ThreeEvent<MouseEvent>) => void }) {
  const records = useMemo(() => {
    const rnd = mulberry32(20260703);
    const out: { x: number; w: number; h: number; z: number; color: string }[] = [];
    const x0 = SHELF.x - SHELF.w / 2 + SHELF.sideT + 0.012;
    const x1 = SHELF.x + SHELF.w / 2 - SHELF.sideT - 0.012;
    let x = x0;
    while (x < x1) {
      const w = 0.009 + rnd() * 0.011;
      if (x + w > x1) break;
      out.push({
        x: x + w / 2,
        w,
        h: 0.275 + rnd() * 0.028,
        z: SHELF_BACK_INNER_Z + 0.15 + (rnd() - 0.5) * 0.014,
        color: SPINE_PALETTE[Math.floor(rnd() * SPINE_PALETTE.length)],
      });
      x += w + 0.0015;
    }
    return out;
  }, []);

  const baseY = SHELF.boardY[0] + SHELF.boardT / 2;
  return (
    <group>
      {records.map((r, i) => (
        <mesh key={i} position={[r.x, baseY + r.h / 2, r.z]} castShadow onClick={onClick}>
          <boxGeometry args={[r.w, r.h, 0.3]} />
          <meshStandardMaterial color={r.color} roughness={0.75} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Woven wicker bin (real weave maps from ambientCG Wicker007A). Slides
 * forward when toggled — bulk record storage. `reserved` front slots are
 * left empty for real albums, which live outside this group and track the
 * slide themselves.
 */
function Basket({
  index,
  seed,
  reserved,
  wicker,
}: {
  index: number;
  seed: number;
  reserved: number;
  wicker: { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture };
}) {
  const group = useRef<THREE.Group>(null);
  const isOut = useStore((s) => s.basketOut === index);
  const { w: W, h: H, d: D } = BASKET;
  const x = BASKET.x[index];

  const records = useMemo(() => {
    const rnd = mulberry32(seed);
    const out: { z: number; tilt: number; drop: number; color: string }[] = [];
    for (let slot = reserved; ; slot++) {
      const z = D / 2 - 0.075 - slot * 0.035;
      if (z < -D / 2 + 0.05) break;
      out.push({
        z,
        tilt: (rnd() - 0.5) * 0.1,
        drop: rnd() * 0.03,
        color: SPINE_PALETTE[Math.floor(rnd() * SPINE_PALETTE.length)],
      });
    }
    return out;
  }, [seed, reserved, D]);

  useFrame((_, dt) => {
    if (!group.current) return;
    easing.damp(group.current.position, "z", BASKET.z + (isOut ? BASKET.outDz : 0), 0.28, dt);
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (dragActiveOrRecent()) return;
    const wasOut = useStore.getState().basketOut === index;
    useStore.getState().toggleBasket(index);
    if (useStore.getState().basketOut !== (wasOut ? index : null)) {
      engine.playSfx(wasOut ? "sleeveIn" : "sleeveOut", 0.7, 0.7);
    }
  };

  return (
    <group ref={group} position={[x, 0, BASKET.z]}>
      {/* decorative records standing inside */}
      {records.map((r, i) => (
        <mesh
          key={i}
          position={[0, SLEEVE.size / 2 + 0.085 - r.drop, r.z]}
          rotation-x={r.tilt}
          castShadow
          onClick={onClick}
        >
          <boxGeometry args={[0.3, SLEEVE.size, 0.012]} />
          <meshStandardMaterial color={r.color} roughness={0.75} />
        </mesh>
      ))}
      {/* dark interior filler hides the hollow between walls and records */}
      <mesh position={[0, H / 2 - 0.03, 0]} onClick={onClick}>
        <boxGeometry args={[W - 0.04, H - 0.08, D - 0.04]} />
        <meshStandardMaterial color="#3a2c1e" roughness={1} />
      </mesh>
      <BasketShell wicker={wicker} onClick={onClick} />
      {/* handle cutout on the front face */}
      <mesh position={[0, H * 0.6, D / 2 + 0.012]} onClick={onClick}>
        <boxGeometry args={[0.1, 0.03, 0.006]} />
        <meshStandardMaterial color="#241a12" roughness={1} />
      </mesh>
    </group>
  );
}

export function Shelf() {
  const albums = useStore((s) => s.albums);

  const [woodDiff, woodNor, woodRough, wickerDiff, wickerNor, wickerRough] = useTexture([
    "/textures/walnut_diff.jpg",
    "/textures/walnut_nor.jpg",
    "/textures/walnut_rough.jpg",
    "/textures/wicker_diff.jpg",
    "/textures/wicker_nor.jpg",
    "/textures/wicker_rough.jpg",
  ]);

  const { walnutH, walnutV, wicker } = useMemo(() => {
    woodDiff.colorSpace = THREE.SRGBColorSpace;
    wickerDiff.colorSpace = THREE.SRGBColorSpace;
    for (const t of [woodDiff, woodNor, woodRough, wickerDiff, wickerNor, wickerRough]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
    }
    // horizontal grain for the cross-planks
    // walnut_diff.jpg is colour-corrected on disk to the reference photo's tone
    const walnutH = new THREE.MeshStandardMaterial({
      map: woodDiff,
      normalMap: woodNor,
      roughnessMap: woodRough,
    });
    // vertical grain for the side/back panels (rotated colour map, no normal
    // map — rotated normals would light incorrectly)
    const rotate = (t: THREE.Texture) => {
      const c = t.clone();
      c.center.set(0.5, 0.5);
      c.rotation = Math.PI / 2;
      c.needsUpdate = true;
      return c;
    };
    const walnutV = new THREE.MeshStandardMaterial({
      map: rotate(woodDiff),
      roughnessMap: rotate(woodRough),
    });
    // fine weave: ~2.5 cm strands like the reference photo
    wickerDiff.repeat.set(2.2, 1.3);
    wickerNor.repeat.set(2.2, 1.3);
    wickerRough.repeat.set(2.2, 1.3);
    return {
      walnutH,
      walnutV,
      wicker: { map: wickerDiff, normalMap: wickerNor, roughnessMap: wickerRough },
    };
  }, [woodDiff, woodNor, woodRough, wickerDiff, wickerNor, wickerRough]);

  const onShelfBackdrop = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (dragActiveOrRecent()) return;
    const action = useStore.getState().clickShelfBackdrop();
    if (action === "putBack") engine.playSfx("sleeveIn", 0.85, 1.05);
  };

  const { x, wallZ, w, d, sideT, boardT, footH, backT, boardY, topBoardY, sideTopY } = SHELF;
  const zMid = wallZ + d / 2;
  const sideH = sideTopY - footH;
  const innerW = w - 2 * sideT;

  // overflow albums per bin (front slots reserved for the real sleeves)
  const overflow = Math.max(albums.length - DISPLAY_SLOTS, 0);
  const reserved = [Math.ceil(overflow / 2), Math.floor(overflow / 2)];

  return (
    <group>
      {/* side panels */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[x + s * (w / 2 - sideT / 2), footH + sideH / 2, zMid]}
          material={walnutV}
          castShadow
          receiveShadow
          onClick={onShelfBackdrop}
        >
          <boxGeometry args={[sideT, sideH, d]} />
        </mesh>
      ))}

      {/* back panel */}
      <mesh
        position={[x, footH + sideH / 2, wallZ + 0.012 + backT / 2]}
        material={walnutV}
        receiveShadow
        onClick={onShelfBackdrop}
      >
        <boxGeometry args={[w - 2 * sideT + 0.02, sideH, backT]} />
      </mesh>

      {/* top board + three cross-planks */}
      {[topBoardY, ...boardY].map((y) => (
        <mesh
          key={y}
          position={[x, y, zMid]}
          material={walnutH}
          castShadow
          receiveShadow
          onClick={onShelfBackdrop}
        >
          <boxGeometry args={[innerW + 0.02, boardT, d - 0.01]} />
        </mesh>
      ))}

      {/* feet */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}${sz}`}
            position={[x + sx * (w / 2 - sideT / 2), footH / 2, zMid + sz * (d / 2 - 0.05)]}
            castShadow
            onClick={onShelfBackdrop}
          >
            <boxGeometry args={[0.055, footH, 0.055]} />
            <meshStandardMaterial color="#211a14" roughness={0.6} />
          </mesh>
        )),
      )}

      {/* the interactive albums: 3+3 face-forward, the rest in the bins */}
      {albums.map((a, i) => (
        <AlbumSleeve key={a.id} album={a} index={i} />
      ))}

      {/* dense collection on the middle shelf */}
      <SpineRow onClick={onShelfBackdrop} />

      {/* pull-out wicker bins — bulk record storage */}
      <Basket index={0} seed={11} reserved={reserved[0]} wicker={wicker} />
      <Basket index={1} seed={47} reserved={reserved[1]} wicker={wicker} />

      <Plant position={[x - 0.45, topBoardY + boardT / 2 + 0.035, wallZ + 0.19]} onClick={onShelfBackdrop} />
    </group>
  );
}
