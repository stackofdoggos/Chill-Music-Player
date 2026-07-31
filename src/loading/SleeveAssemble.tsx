import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { TIMING } from './assembleConfig'
import { useAssembleLoop } from './useAssembleLoop'

const SLEEVE = 0.36
const SLEEVE_T = 0.01
const VINYL_R = 0.155

function makeClearMat() {
  return new THREE.MeshPhysicalMaterial({
    color: '#f4f7fb',
    metalness: 0.02,
    roughness: 0.08,
    transmission: 0.94,
    thickness: 0.45,
    ior: 1.48,
    transparent: true,
    opacity: 1,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
}

export function SleeveAssemble() {
  const spinRef = useRef<THREE.Group>(null)
  const backRef = useRef<THREE.Mesh>(null)
  const frontRef = useRef<THREE.Mesh>(null)
  const vinylRef = useRef<THREE.Group>(null)
  const hubRef = useRef<THREE.Mesh>(null)

  const geos = useMemo(
    () => ({
      panel: new THREE.BoxGeometry(SLEEVE, SLEEVE_T, SLEEVE),
      vinyl: new THREE.CylinderGeometry(VINYL_R, VINYL_R, 0.0026, 96),
      hub: new THREE.TorusGeometry(0.017, 0.0055, 20, 56),
      label: new THREE.CylinderGeometry(0.052, 0.052, 0.0028, 64),
      hole: new THREE.CylinderGeometry(0.012, 0.012, 0.0032, 32),
    }),
    [],
  )

  const mats = useMemo(
    () => ({
      clear: makeClearMat(),
      vinyl: new THREE.MeshStandardMaterial({
        color: '#101012',
        roughness: 0.38,
        metalness: 0.22,
      }),
      label: new THREE.MeshStandardMaterial({
        color: '#ebe6dc',
        roughness: 0.55,
        metalness: 0.04,
      }),
      hub: new THREE.MeshPhysicalMaterial({
        color: '#d5dae0',
        roughness: 0.22,
        metalness: 0.75,
        clearcoat: 0.5,
      }),
    }),
    [],
  )

  useLayoutEffect(() => {
    if (backRef.current) {
      backRef.current.position.set(0, -0.018, 0)
      backRef.current.scale.setScalar(1)
      backRef.current.visible = true
    }
    if (frontRef.current) {
      frontRef.current.position.set(0, 0.85, 0)
      frontRef.current.scale.setScalar(0.001)
      frontRef.current.visible = false
    }
    if (vinylRef.current) {
      vinylRef.current.position.set(0, 2.8, 0)
      vinylRef.current.scale.setScalar(0.001)
      vinylRef.current.visible = false
    }
    if (hubRef.current) {
      hubRef.current.position.set(0, 3.2, 0)
      hubRef.current.scale.setScalar(0.001)
      hubRef.current.visible = false
    }
  }, [])

  useAssembleLoop(
    true,
    (tl) => {
      const spin = spinRef.current
      const back = backRef.current
      const front = frontRef.current
      const vinyl = vinylRef.current
      const hub = hubRef.current
      if (!spin || !back || !front || !vinyl || !hub) return

      // Top-down: spin only around Y (camera looks down -Y).
      gsap.set(spin.rotation, { x: 0, y: 0, z: 0 })

      gsap.set(back.position, { x: 0, y: -0.018, z: 0 })
      gsap.set(back.scale, { x: 0.96, y: 0.96, z: 0.96 })
      back.visible = true

      front.visible = false
      gsap.set(front.position, { x: 0, y: 0.85, z: 0 })
      gsap.set(front.scale, { x: 0.001, y: 0.001, z: 0.001 })

      // Fly in from above camera (+Y) down onto the sleeve
      vinyl.visible = false
      gsap.set(vinyl.position, { x: 0, y: 2.8, z: 0 })
      gsap.set(vinyl.scale, { x: 0.001, y: 0.001, z: 0.001 })
      gsap.set(vinyl.rotation, { x: 0, y: 0, z: 0 })

      hub.visible = false
      gsap.set(hub.position, { x: 0, y: 3.2, z: 0 })
      gsap.set(hub.scale, { x: 0.001, y: 0.001, z: 0.001 })
      gsap.set(hub.rotation, { x: Math.PI / 2, y: 0, z: 0 })

      // 1) Back half present
      tl.to(back.scale, { x: 1, y: 1, z: 1, duration: TIMING.partIn, ease: 'power3.out' }, 0)

      // 2) Center hole / hub flies from behind camera onto the back half
      const hubT = 0.22
      tl.call(() => {
        hub.visible = true
      }, undefined, hubT)
      tl.to(hub.position, { x: 0, y: 0.004, z: 0, duration: 0.8, ease: 'power3.inOut' }, hubT)
      tl.to(hub.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'back.out(1.55)' }, hubT)
      tl.to(hub.rotation, { z: Math.PI * 1.75, duration: 0.8, ease: 'none' }, hubT)

      // 3) Vinyl follows through the camera onto the back half
      const vinylT = 0.5
      tl.call(() => {
        vinyl.visible = true
      }, undefined, vinylT)
      tl.to(vinyl.position, { x: 0, y: 0, z: 0, duration: 0.85, ease: 'power3.inOut' }, vinylT)
      tl.to(vinyl.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'back.out(1.25)' }, vinylT)
      tl.to(vinyl.rotation, { y: Math.PI * 1.1, duration: 0.85, ease: 'none' }, vinylT)

      // 4) Front clear half settles on top
      const frontT = 1.25
      tl.call(() => {
        front.visible = true
      }, undefined, frontT)
      tl.to(
        front.position,
        { x: 0, y: 0.018, z: 0, duration: TIMING.partIn * 1.15, ease: 'power3.out' },
        frontT,
      )
      tl.to(
        front.scale,
        { x: 1, y: 1, z: 1, duration: TIMING.partIn, ease: 'back.out(1.2)' },
        frontT,
      )

      // 5) Present spin (yaw only — stays top-down)
      const spinT = frontT + TIMING.partIn + TIMING.settle
      tl.to(
        spin.rotation,
        { y: Math.PI * 2, x: 0, z: 0, duration: TIMING.spinHold, ease: 'power1.inOut' },
        spinT,
      )
    },
    [],
  )

  return (
    <group ref={spinRef} position={[0, 0, 0]} scale={1.7}>
      <mesh ref={backRef} geometry={geos.panel} material={mats.clear} />
      <group ref={vinylRef}>
        <mesh geometry={geos.vinyl} material={mats.vinyl} />
        <mesh geometry={geos.label} material={mats.label} position={[0, 0.0012, 0]} />
      </group>
      <mesh
        ref={hubRef}
        geometry={geos.hub}
        material={mats.hub}
        rotation={[Math.PI / 2, 0, 0]}
      />
      <mesh ref={frontRef} geometry={geos.panel} material={mats.clear} />
    </group>
  )
}
