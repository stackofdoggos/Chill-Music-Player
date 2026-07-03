import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { dragActiveOrRecent, useStore } from "../../state/store";
import { engine } from "../../audio/engine";
import { woodTexture } from "../textures";
import { SHELF, SHELF_BACK_INNER_Z, SLEEVE } from "../layout";
import { AlbumSleeve } from "./AlbumSleeve";

/** deterministic PRNG so the decorative records/bins never reshuffle */
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

function Plant({ position, onClick }: { position: [number, number, number]; onClick: (e: ThreeEvent<MouseEvent>) => void }) {
  const leaves = [
    { r: 0, h: 0.22, lean: 0.05 },
    { r: 1.2, h: 0.27, lean: 0.12 },
    { r: 2.4, h: 0.19, lean: -0.1 },
    { r: 3.8, h: 0.25, lean: 0.08 },
    { r: 5.0, h: 0.21, lean: -0.14 },
  ];
  return (
    <group position={position}>
      <mesh castShadow onClick={onClick}>
        <cylinderGeometry args={[0.045, 0.035, 0.07, 24]} />
        <meshStandardMaterial color="#e8e5df" roughness={0.8} />
      </mesh>
      {leaves.map((l, i) => (
        <group key={i} rotation-y={l.r} position-y={0.03}>
          <mesh position-y={l.h / 2} rotation-x={l.lean} castShadow onClick={onClick}>
            <coneGeometry args={[0.016, l.h, 6]} />
            <meshStandardMaterial color="#4a6b4f" roughness={0.7} />
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
        h: 0.29 + rnd() * 0.024,
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

/** woven basket built from stacked square hoops, filled with record sleeves */
function Basket({
  position,
  seed,
  onClick,
}: {
  position: [number, number, number];
  seed: number;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const W = 0.42;
  const D = 0.3;
  const H = 0.3;
  const HOOPS = 6;
  const hoopH = H / HOOPS;

  const records = useMemo(() => {
    const rnd = mulberry32(seed);
    const out: { z: number; tilt: number; color: string }[] = [];
    let z = -D / 2 + 0.05;
    while (z < D / 2 - 0.03) {
      out.push({
        z,
        tilt: (rnd() - 0.5) * 0.12,
        color: SPINE_PALETTE[Math.floor(rnd() * SPINE_PALETTE.length)],
      });
      z += 0.02 + rnd() * 0.014;
    }
    return out;
  }, [seed]);

  return (
    <group position={position}>
      {/* records standing inside, tops peeking over the rim */}
      {records.map((r, i) => (
        <mesh
          key={i}
          position={[0, SLEEVE.size / 2 + 0.055, r.z]}
          rotation-x={r.tilt}
          castShadow
          onClick={onClick}
        >
          <boxGeometry args={[0.3, SLEEVE.size, 0.012]} />
          <meshStandardMaterial color={r.color} roughness={0.75} />
        </mesh>
      ))}
      {/* dark interior filler hides the hollow between hoops and records */}
      <mesh position={[0, H / 2 - 0.03, 0]} onClick={onClick}>
        <boxGeometry args={[W - 0.05, H - 0.08, D - 0.05]} />
        <meshStandardMaterial color="#3a2c1e" roughness={1} />
      </mesh>
      {/* woven walls: stacked, slightly tapered square hoops */}
      {Array.from({ length: HOOPS }, (_, i) => {
        const t = i / (HOOPS - 1);
        const scale = 0.93 + 0.07 * t;
        return (
          <mesh
            key={i}
            position={[0, hoopH * (i + 0.5), 0]}
            rotation-y={Math.PI / 4}
            scale={[scale, 1, (scale * D) / W]}
            castShadow
            onClick={onClick}
          >
            <cylinderGeometry args={[W / Math.SQRT2, (W / Math.SQRT2) * 0.985, hoopH - 0.003, 4]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? "#b98d5f" : "#a97e52"}
              roughness={0.85}
            />
          </mesh>
        );
      })}
      {/* rim */}
      <mesh position={[0, H + 0.008, 0]} rotation-y={Math.PI / 4} scale={[1.02, 1, (1.02 * D) / W]} castShadow onClick={onClick}>
        <cylinderGeometry args={[W / Math.SQRT2, W / Math.SQRT2, 0.022, 4]} />
        <meshStandardMaterial color="#8f6a44" roughness={0.8} />
      </mesh>
      {/* handle cutout on the front face */}
      <mesh position={[0, H * 0.62, D / 2 + 0.002]} onClick={onClick}>
        <boxGeometry args={[0.09, 0.028, 0.006]} />
        <meshStandardMaterial color="#241a12" roughness={1} />
      </mesh>
    </group>
  );
}

export function Shelf() {
  const albums = useStore((s) => s.albums);

  const walnut = useMemo(() => {
    const map = woodTexture(1.4, 1.4);
    return new THREE.MeshStandardMaterial({ map, color: "#77604f", roughness: 0.6 });
  }, []);

  const onShelfBackdrop = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (dragActiveOrRecent()) return;
    const action = useStore.getState().clickShelfBackdrop();
    if (action === "putBack") engine.playSfx("sleeveIn", 0.85, 1.05);
  };

  const { x, wallZ, w, d, sideT, boardT, backT, footH, boardY, topBoardY, sideTopY } = SHELF;
  const zMid = wallZ + d / 2;
  const sideH = sideTopY - footH;
  const innerW = w - 2 * sideT;

  return (
    <group>
      {/* side panels */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[x + s * (w / 2 - sideT / 2), footH + sideH / 2, zMid]}
          material={walnut}
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
        material={walnut}
        receiveShadow
        onClick={onShelfBackdrop}
      >
        <boxGeometry args={[w - 2 * sideT + 0.02, sideH, backT]} />
      </mesh>

      {/* top board + three shelf boards */}
      {[topBoardY, ...boardY].map((y) => (
        <mesh
          key={y}
          position={[x, y, zMid]}
          material={walnut}
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
            <boxGeometry args={[0.05, footH, 0.05]} />
            <meshStandardMaterial color="#211a14" roughness={0.6} />
          </mesh>
        )),
      )}

      {/* the interactive albums, face-forward on the top two shelves */}
      {albums.map((a, i) => (
        <AlbumSleeve key={a.id} album={a} index={i} />
      ))}

      {/* dense collection on the middle shelf */}
      <SpineRow onClick={onShelfBackdrop} />

      {/* wicker record bins under the bottom shelf */}
      <Basket position={[x - 0.28, 0, wallZ + 0.25]} seed={11} onClick={onShelfBackdrop} />
      <Basket position={[x + 0.28, 0, wallZ + 0.25]} seed={47} onClick={onShelfBackdrop} />

      <Plant position={[x - 0.5, topBoardY + boardT / 2 + 0.035, wallZ + 0.18]} onClick={onShelfBackdrop} />
    </group>
  );
}
