import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";
import { createPortal } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { easing } from "maath";
import { dragActiveOrRecent, useStore } from "../../state/store";
import { engine } from "../../audio/engine";
import { useSceneModel } from "../SceneModel";
import { BASKET, DISPLAY_SLOTS, SLEEVE } from "../layout";
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

function Basket({ index, seed, reserved }: { index: number; seed: number; reserved: number }) {
  const { nodes } = useSceneModel();
  const root = nodes[index === 0 ? "basket_L" : "basket_R"];
  const isOut = useStore((s) => s.basketOut === index);
  const { w: W, h: H, d: D } = BASKET;

  const [wickerDiff, wickerNor, wickerRough] = useTexture([
    "/textures/wicker_diff.jpg",
    "/textures/wicker_nor.jpg",
    "/textures/wicker_rough.jpg",
  ]);

  const wicker = useMemo(() => {
    wickerDiff.colorSpace = THREE.SRGBColorSpace;
    for (const t of [wickerDiff, wickerNor, wickerRough]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
    }
    wickerDiff.repeat.set(2.2, 1.3);
    wickerNor.repeat.set(2.2, 1.3);
    wickerRough.repeat.set(2.2, 1.3);
    return { map: wickerDiff, normalMap: wickerNor, roughnessMap: wickerRough };
  }, [wickerDiff, wickerNor, wickerRough]);

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
    if (!root) return;
    easing.damp(root.position, "z", BASKET.z + (isOut ? BASKET.outDz : 0), 0.28, dt);
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

  if (!root) return null;

  return createPortal(
    <group>
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
      <mesh position={[0, H / 2 - 0.03, 0]} onClick={onClick}>
        <boxGeometry args={[W - 0.04, H - 0.08, D - 0.04]} />
        <meshStandardMaterial color="#3a2c1e" roughness={1} />
      </mesh>
      <BasketShell wicker={wicker} onClick={onClick} />
      <mesh position={[0, H * 0.6, D / 2 + 0.012]} onClick={onClick}>
        <boxGeometry args={[0.1, 0.03, 0.006]} />
        <meshStandardMaterial color="#241a12" roughness={1} />
      </mesh>
    </group>,
    root,
  );
}

/** Static bookcase geometry is in room.glb; albums + bin slide logic stay in code. */
export function Shelf() {
  const albums = useStore((s) => s.albums);
  const overflow = Math.max(albums.length - DISPLAY_SLOTS, 0);
  const reserved = [Math.ceil(overflow / 2), Math.floor(overflow / 2)];

  return (
    <>
      {albums.map((a, i) => (
        <AlbumSleeve key={a.id} album={a} index={i} />
      ))}
      <Basket index={0} seed={11} reserved={reserved[0]} />
      <Basket index={1} seed={47} reserved={reserved[1]} />
    </>
  );
}
