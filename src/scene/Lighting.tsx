import { Environment, Lightformer } from '@react-three/drei'

export function Lighting() {
  return (
    <>
      <hemisphereLight args={['#fff6e8', '#c4baa8', 0.7]} />
      {/* warm key, as if from a window on the right */}
      <directionalLight
        position={[2.4, 2.9, 1.7]}
        intensity={1.7}
        color="#ffeed6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-1}
        shadow-camera-far={10}
      />
      {/* cool fill from the front-left */}
      <directionalLight position={[-2, 1.8, 2.2]} intensity={0.35} color="#e8eef4" />
      {/* offline environment for reflections on metal / acrylic */}
      <Environment resolution={256}>
        <Lightformer intensity={3} position={[3, 1.6, 0]} rotation-y={-Math.PI / 2} scale={[3, 2, 1]} color="#fff3df" />
        <Lightformer intensity={1.2} position={[0, 2.8, 0]} rotation-x={Math.PI / 2} scale={[4, 4, 1]} color="#ffffff" />
        <Lightformer intensity={0.8} position={[0, 1.2, 3]} scale={[4, 2, 1]} color="#e8e4da" />
        <Lightformer intensity={0.4} position={[-3, 1.2, 0]} rotation-y={Math.PI / 2} scale={[3, 2, 1]} color="#d8d4ca" />
      </Environment>
    </>
  )
}
