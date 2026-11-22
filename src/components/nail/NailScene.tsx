import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { FINGER, createNailGeometry, nailNormal, nailPoint } from './nailShape'
import { createPolishMaterial } from './polishMaterial'
import { CYCLE, STILL_TIME, frameAt } from './timeline'

export interface NailSceneProps {
  /** culorile prin care trece animația, în ordine */
  colors: string[]
  /** indexul culorii alese de utilizatoare; schimbarea lui repornește pictarea */
  requested: { index: number; nonce: number } | null
  /** apelat când începe o culoare nouă (ca UI-ul să marcheze culoarea curentă) */
  onColorChange?: (index: number) => void
  /** fără animație: un singur cadru, unghia deja pictată */
  still?: boolean
  /** oprește randarea când scena nu e pe ecran */
  paused?: boolean
  /** pentru capturi deterministe: îngheață timpul la această valoare */
  frozenTime?: number | null
}

const SKIN = '#ecc3ad'
const PLUM = '#6b3f52'

// Poziția de bază a mâinii: unghia spre cameră, degetul ieșind din colțul de jos-stânga.
const HAND_RX = -0.42
const HAND_RZ = -0.62

// ---------------------------------------------------------------- deget + unghie

function Finger({ polish }: { polish: ReturnType<typeof createPolishMaterial> }) {
  const nailGeo = useMemo(() => createNailGeometry(), [])
  useEffect(() => () => nailGeo.dispose(), [nailGeo])

  return (
    <group>
      <mesh scale={[1, 1, FINGER.flatten]}>
        <capsuleGeometry args={[FINGER.radius, FINGER.length, 12, 32]} />
        <meshPhysicalMaterial
          color={SKIN}
          roughness={0.55}
          sheen={0.6}
          sheenColor="#f6d2c6"
          sheenRoughness={0.6}
        />
      </mesh>
      <mesh geometry={nailGeo} material={polish.material} />
    </group>
  )
}

// ---------------------------------------------------------------- pensula

function Brush({ bristleMaterial }: { bristleMaterial: THREE.Material }) {
  // Perii: un profil rotit (lathe), apoi turtit ca o pensulă plată de ojă. Vârful e în origine.
  const bristleGeo = useMemo(() => {
    const profile = [
      [0.0, 0.0], [0.045, 0.004], [0.075, 0.03], [0.085, 0.1], [0.078, 0.2], [0.055, 0.3], [0.04, 0.34],
    ].map(([r, y]) => new THREE.Vector2(r, y))
    return new THREE.LatheGeometry(profile, 32)
  }, [])
  useEffect(() => () => bristleGeo.dispose(), [bristleGeo])

  return (
    <group>
      <mesh name="bristles" geometry={bristleGeo} material={bristleMaterial} scale={[1.15, 1, 0.42]} />
      {/* tija */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.03, 0.036, 0.36, 16]} />
        <meshPhysicalMaterial color="#d9c7c9" metalness={0.9} roughness={0.25} />
      </mesh>
      {/* capacul sticluței, care e și mânerul pensulei */}
      <mesh position={[0, 1.27, 0]}>
        <cylinderGeometry args={[0.105, 0.125, 1.2, 48]} />
        <meshPhysicalMaterial color={PLUM} roughness={0.25} clearcoat={1} clearcoatRoughness={0.1} />
      </mesh>
      <mesh position={[0, 1.87, 0]}>
        <sphereGeometry args={[0.105, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial color={PLUM} roughness={0.25} clearcoat={1} clearcoatRoughness={0.1} />
      </mesh>
      <mesh position={[0, 0.7, 0]}>
        <torusGeometry args={[0.124, 0.01, 12, 48]} />
        <meshPhysicalMaterial color="#e8c4c4" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------- scena animată

function Manicure({ colors, requested, onColorChange, still, frozenTime }: NailSceneProps) {
  const polish = useMemo(() => createPolishMaterial(), [])
  const bristleMat = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: colors[0], roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 }),
    [colors],
  )
  useEffect(() => () => {
    polish.material.dispose()
    bristleMat.dispose()
  }, [polish, bristleMat])

  const invalidate = useThree((s) => s.invalidate)
  const hand = useRef<THREE.Group>(null)
  const brush = useRef<THREE.Group>(null)

  // Ceasul propriu (nu cel global): pauza nu face animația să „sară”.
  const clock = useRef({ time: still ? STILL_TIME : 0, cycle: 0, colorIndex: 0, baseIndex: -1 })

  const applyColors = (colorIndex: number, baseIndex: number) => {
    polish.uniforms.uColor.value.set(colors[colorIndex])
    bristleMat.color.set(colors[colorIndex])
    if (baseIndex >= 0) polish.uniforms.uBase.value.set(colors[baseIndex])
    polish.uniforms.uBaseMix.value = baseIndex >= 0 ? 1 : 0
    onColorChange?.(colorIndex)
  }

  // Prima culoare se aplică o singură dată, la montare.
  useEffect(() => {
    applyColors(0, -1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Utilizatoarea a ales o culoare: o pictăm peste cea de acum.
  useEffect(() => {
    if (!requested) return
    const c = clock.current
    const painted = frameAt(c.time).painted
    c.baseIndex = painted ? c.colorIndex : c.baseIndex
    c.colorIndex = requested.index
    c.time = still ? STILL_TIME : 0
    c.cycle = 0
    applyColors(c.colorIndex, c.baseIndex)
    invalidate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested])

  const tmp = useMemo(
    () => ({ p: new THREE.Vector3(), n: new THREE.Vector3(), dir: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), q: new THREE.Quaternion(), along: new THREE.Vector3(), side: new THREE.Vector3(1, 0, 0) }),
    [],
  )

  useFrame((state, delta) => {
    const c = clock.current
    if (frozenTime != null) c.time = frozenTime
    else if (!still) c.time += Math.min(delta, 0.1)

    // la fiecare ciclu nou: culoarea de acum devine baza, următoarea culoare se pictează peste
    const cycle = Math.floor(c.time / CYCLE)
    if (cycle !== c.cycle && frozenTime == null && !still) {
      c.cycle = cycle
      c.baseIndex = c.colorIndex
      c.colorIndex = (c.colorIndex + 1) % colors.length
      applyColors(c.colorIndex, c.baseIndex)
    }

    const f = frameAt(c.time)
    polish.uniforms.uFronts.value.set(f.fronts[0], f.fronts[1], f.fronts[2])
    polish.uniforms.uGlint.value = f.glint

    // pensula: vârful pe suprafață, mânerul înclinat înapoi spre cuticulă
    if (brush.current) {
      const { u, t, lift, contact } = f.brush
      nailPoint(Math.min(Math.max(u, -0.4), 1.4), Math.min(Math.max(t, 0), 1.05), tmp.p)
      nailNormal(Math.min(Math.max(u, 0), 1), Math.min(Math.max(t, 0), 1), tmp.n)
      tmp.along.set(0, 1, 0)
      // mânerul se înclină în direcția mișcării (perii rămân în urmă), departe de privitor
      tmp.dir.copy(tmp.n).multiplyScalar(0.62).addScaledVector(tmp.along, 0.72).addScaledVector(tmp.side, 0.25).normalize()
      tmp.q.setFromUnitVectors(tmp.up, tmp.dir)
      brush.current.quaternion.copy(tmp.q)
      brush.current.position.copy(tmp.p).addScaledVector(tmp.n, lift - contact * 0.012)
      const bristles = brush.current.getObjectByName('bristles')
      if (bristles) bristles.scale.y = 1 - contact * 0.14
    }

    // mâna urmărește discret mouse-ul
    if (hand.current && !still) {
      const k = 1 - Math.exp(-3 * delta)
      hand.current.rotation.y += (state.pointer.x * 0.25 - hand.current.rotation.y) * k
      hand.current.rotation.x += (HAND_RX - state.pointer.y * 0.12 - hand.current.rotation.x) * k
    }
  })

  return (
    <group ref={hand} rotation={[HAND_RX, 0, HAND_RZ]} position={[0.15, -0.1, 0]}>
      {/* centrul unghiei ajunge în centrul cadrului */}
      <group position={[0, -1.05, -0.4]}>
        <Finger polish={polish} />
        <group ref={brush}>
          <Brush bristleMaterial={bristleMat} />
        </group>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------- canvas

export default function NailScene(props: NailSceneProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 5.1], fov: 30 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      frameloop={props.paused ? 'never' : props.still ? 'demand' : 'always'}
      aria-hidden="true"
    >
      <ambientLight intensity={0.35} />
      <directionalLight position={[2.5, 4, 5]} intensity={1.6} color="#fff4f2" />
      <directionalLight position={[-4, -1, 2]} intensity={0.5} color="#e8c4c4" />

      <Manicure {...props} />

      <ContactShadows position={[0, -1.6, 0]} opacity={0.28} scale={7} blur={2.6} far={3} color={PLUM} />

      {/* Studio de lumini generat local (fără fișiere HDR descărcate) — dă reflexiile lucioase ale ojei. */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={2.2} position={[0, 3, 4]} scale={[6, 1.4, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[-4, 1, 2]} rotation-y={Math.PI / 2} scale={[4, 2, 1]} color="#f6d9d9" />
        <Lightformer form="rect" intensity={0.8} position={[4, -1, 2]} rotation-y={-Math.PI / 2} scale={[4, 2, 1]} />
        <Lightformer form="ring" intensity={1.5} position={[2, 2, 6]} scale={1.2} />
      </Environment>
    </Canvas>
  )
}
