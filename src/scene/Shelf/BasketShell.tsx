import type { ThreeEvent } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { BASKET } from "../layout";
import { BasketLid } from "./BasketLid";

type WickerMaps = {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
};

function wickerMat(wicker: WickerMaps) {
  return (
    <meshStandardMaterial
      map={wicker.map}
      normalMap={wicker.normalMap}
      roughnessMap={wicker.roughnessMap}
      normalScale={new THREE.Vector2(1, 1)}
    />
  );
}

/** Open-top woven walls — default when `BASKET.showLids` is false. */
function OpenBasketShell({
  wicker,
  onClick,
}: {
  wicker: WickerMaps;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const { w: W, h: H, d: D } = BASKET;
  const t = 0.02;
  const yMid = H / 2;
  const mat = wickerMat(wicker);

  const wall = (pos: [number, number, number], args: [number, number, number]) => (
    <mesh key={`${pos.join("-")}-${args.join("-")}`} position={pos} castShadow receiveShadow onClick={onClick}>
      <boxGeometry args={args} />
      {mat}
    </mesh>
  );

  return (
    <>
      {wall([0, yMid, D / 2 - t / 2], [W, H, t])}
      {wall([0, yMid, -D / 2 + t / 2], [W, H, t])}
      {wall([W / 2 - t / 2, yMid, 0], [t, H, D])}
      {wall([-W / 2 + t / 2, yMid, 0], [t, H, D])}
      {wall([0, t / 2, 0], [W, t, D])}
    </>
  );
}

/** Closed woven shell + flat cap — restore by setting `BASKET.showLids` to true. */
function LiddedBasketShell({
  wicker,
  onClick,
}: {
  wicker: WickerMaps;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const { w: W, h: H, d: D } = BASKET;

  return (
    <>
      <RoundedBox
        args={[W, H, D]}
        radius={0.02}
        smoothness={4}
        position={[0, H / 2, 0]}
        castShadow
        receiveShadow
        onClick={onClick}
      >
        {wickerMat(wicker)}
      </RoundedBox>
      <BasketLid wicker={wicker} onClick={onClick} />
    </>
  );
}

export function BasketShell({
  wicker,
  onClick,
}: {
  wicker: WickerMaps;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
}) {
  return BASKET.showLids ? (
    <LiddedBasketShell wicker={wicker} onClick={onClick} />
  ) : (
    <OpenBasketShell wicker={wicker} onClick={onClick} />
  );
}
