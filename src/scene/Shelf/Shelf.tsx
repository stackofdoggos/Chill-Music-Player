import type { ThreeEvent } from "@react-three/fiber";
import { dragActiveOrRecent, useStore } from "../../state/store";
import { engine } from "../../audio/engine";
import { SHELF, SHELF_FOCUS, SLEEVE, sleeveSlot } from "../layout";
import { AlbumSleeve } from "./AlbumSleeve";

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

export function Shelf() {
  const albums = useStore((s) => s.albums);

  const onShelfBackdrop = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (dragActiveOrRecent()) return;
    const action = useStore.getState().clickShelfBackdrop();
    if (action === "putBack") engine.playSfx("sleeveIn", 0.85, 1.05);
  };

  const lastSlot = sleeveSlot(Math.max(albums.length - 1, 0));

  return (
    <group>
      {/* back-wall click band behind the shelf (records in front still win the raycast) */}
      <mesh position={[SHELF_FOCUS.x, SHELF_FOCUS.y, SHELF_FOCUS.z]} onClick={onShelfBackdrop}>
        <planeGeometry args={[SHELF_FOCUS.w, SHELF_FOCUS.h]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* uprights (606-style E-tracks against the wall) */}
      {SHELF.uprightX.map((x) => (
        <mesh
          key={x}
          position={[x, 1.25, SHELF.wallZ + 0.015]}
          castShadow
          onClick={onShelfBackdrop}
        >
          <boxGeometry args={[0.024, 1.9, 0.024]} />
          <meshStandardMaterial
            color="#d8d6d2"
            metalness={0.7}
            roughness={0.35}
          />
        </mesh>
      ))}
      {/* shelves */}
      {SHELF.shelfY.map((y) => (
        <group key={y}>
          <mesh
            position={[SHELF.x, y, SHELF.wallZ + 0.03 + SHELF.d / 2]}
            castShadow
            receiveShadow
            onClick={onShelfBackdrop}
          >
            <boxGeometry args={[SHELF.w, 0.018, SHELF.d]} />
            <meshStandardMaterial
              color="#eceae6"
              metalness={0.12}
              roughness={0.5}
            />
          </mesh>
          {/* slim support pins into the uprights */}
          {SHELF.uprightX.map((x) => (
            <mesh key={x} position={[x, y - 0.014, SHELF.wallZ + 0.05]}>
              <boxGeometry args={[0.018, 0.01, 0.06]} />
              <meshStandardMaterial
                color="#c8c6c2"
                metalness={0.7}
                roughness={0.35}
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* the records */}
      {albums.map((a, i) => (
        <AlbumSleeve key={a.id} album={a} index={i} />
      ))}

      {/* bookend keeping the row upright */}
      <group
        position={[
          lastSlot.x + SLEEVE.thickness / 2 + 0.012,
          SHELF.shelfY[1] + 0.018,
          -2.0,
        ]}
      >
        <mesh castShadow onClick={onShelfBackdrop}>
          <boxGeometry args={[0.006, 0.16, 0.13]} />
          <meshStandardMaterial
            color="#9a9896"
            metalness={0.8}
            roughness={0.3}
          />
        </mesh>
        <mesh position={[-0.035, -0.075, 0]} onClick={onShelfBackdrop}>
          <boxGeometry args={[0.075, 0.004, 0.13]} />
          <meshStandardMaterial
            color="#9a9896"
            metalness={0.8}
            roughness={0.3}
          />
        </mesh>
      </group>

      {/* a couple of sleeves lying flat on the bottom shelf */}
      <group position={[1.37, SHELF.shelfY[0] + 0.018 + 0.015, -1.98]}>
        {[0, 1].map((i) => (
          <mesh key={i} position-y={i * 0.016} rotation-y={i * 0.06} castShadow onClick={onShelfBackdrop}>
            <boxGeometry args={[SLEEVE.size, 0.0145, SLEEVE.size]} />
            <meshStandardMaterial
              color={i === 0 ? "#37352f" : "#cfc6b8"}
              roughness={0.7}
            />
          </mesh>
        ))}
      </group>

      <Plant position={[0.75, SHELF.shelfY[2] + 0.018 + 0.035, -2.02]} onClick={onShelfBackdrop} />
    </group>
  );
}
