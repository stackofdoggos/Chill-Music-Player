import type { ThreeEvent } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { BASKET } from "../layout";

type WickerMaps = {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
};

/** Flat woven cap that sits on top of a bin. Toggle via `BASKET.showLids`. */
export function BasketLid({
  wicker,
  onClick,
}: {
  wicker: WickerMaps;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const { w: W, h: H, d: D } = BASKET;

  return (
    <RoundedBox
      args={[W + 0.02, 0.03, D + 0.02]}
      radius={0.012}
      smoothness={4}
      position={[0, H, 0]}
      castShadow
      onClick={onClick}
    >
      <meshStandardMaterial
        map={wicker.map}
        normalMap={wicker.normalMap}
        roughnessMap={wicker.roughnessMap}
        color="#c19a6b"
      />
    </RoundedBox>
  );
}
