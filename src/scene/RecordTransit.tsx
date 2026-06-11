import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { useStore, selectedAlbum, PHASE_DURATION } from '../state/store'
import { engine } from '../audio/engine'
import { Vinyl } from './Shelf/Vinyl'
import { SLEEVE_OUT_POS, VINYL_REST, easeInOutCubic } from './layout'

const Q_VERTICAL = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0))
const Q_FLAT = new THREE.Quaternion()
const tmpQ = new THREE.Quaternion()
const tmpE = new THREE.Euler()

function smoothstep(a: number, b: number, x: number) {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

/** the active album's record while it travels between sleeve and platter */
export function RecordTransit() {
  const group = useRef<THREE.Group>(null)
  const phase = useStore((s) => s.recordPhase)
  const phaseStart = useStore((s) => s.phaseStart)
  const album = useStore(selectedAlbum)
  const needle = useStore((s) => s.needle)
  const [hover, setHover] = useState(false)
  const placedSfx = useRef(false)
  const prevPhase = useRef(phase)

  const draggingTonearm = useStore((s) => s.draggingTonearm)
  const clickable = phase === 'onPlatter' && needle === 'rest' && !draggingTonearm
  useCursor(hover && clickable)

  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        SLEEVE_OUT_POS.clone(),
        new THREE.Vector3(0.82, 1.4, -1.42),
        new THREE.Vector3(-0.15, 1.18, -1.52),
        VINYL_REST.clone().add(new THREE.Vector3(0.01, 0.13, 0.015)),
        VINYL_REST.clone(),
      ]),
    [],
  )

  useEffect(() => {
    if (phase === 'toPlatter') {
      placedSfx.current = false
      engine.loadAlbum(useStore.getState().albums.find((a) => a.id === useStore.getState().selectedAlbumId) ?? null)
      engine.playSfx('vinylOut', 0.9)
    } else if (phase === 'returning') {
      engine.loadAlbum(null)
      engine.playSfx('vinylOut', 0.5, 1.1)
    } else if (phase === 'none' && prevPhase.current === 'returning') {
      engine.playSfx('sleeveIn', 0.7)
    }
    prevPhase.current = phase
  }, [phase])

  useFrame(() => {
    if (!group.current) return
    const g = group.current
    if (phase === 'toPlatter' || phase === 'returning') {
      const dur = PHASE_DURATION[phase]
      const t = THREE.MathUtils.clamp((performance.now() - phaseStart) / 1000 / dur, 0, 1)
      const k = phase === 'toPlatter' ? easeInOutCubic(t) : 1 - easeInOutCubic(t)
      curve.getPoint(k, g.position)
      tmpQ.slerpQuaternions(Q_VERTICAL, Q_FLAT, smoothstep(0.35, 0.85, k))
      g.quaternion.copy(tmpQ)
      if (phase === 'toPlatter' && k > 0.92 && !placedSfx.current) {
        placedSfx.current = true
        engine.playSfx('recordPlace', 0.85)
      }
    } else if (phase === 'onPlatter') {
      g.position.copy(VINYL_REST)
      tmpE.set(0, engine.platterAngle, 0)
      g.quaternion.setFromEuler(tmpE)
    }
  })

  if (!album || (phase !== 'toPlatter' && phase !== 'onPlatter' && phase !== 'returning')) return null

  return (
    <group ref={group} position={SLEEVE_OUT_POS.toArray()}>
      <Vinyl
        album={album}
        onClick={(e) => {
          e.stopPropagation()
          if (clickable) {
            useStore.getState().returnRecord()
          } else if (phase === 'onPlatter') {
            useStore.getState().setHint('Lift the needle to its rest before removing the record')
          }
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
        }}
        onPointerOut={() => setHover(false)}
      />
    </group>
  )
}
