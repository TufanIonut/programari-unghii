import * as THREE from 'three'

// Unghia e o suprafață parametrică: u ∈ [0,1] de-a latul (stânga → dreapta),
// t ∈ [0,1] pe lungime (cuticulă → vârf). Aceeași funcție dă și poziția pensulei,
// ca vârful pensulei să atingă exact suprafața pe care se pictează.

export const FINGER = {
  radius: 0.62,
  length: 2.2,        // partea cilindrică a capsulei
  flatten: 0.78,      // degetul e puțin turtit (nu e un cilindru perfect)
}

export const NAIL = {
  width: 0.92,
  length: 1.28,
  cuticleY: 0.42,     // unde începe unghia pe deget
  cuticleCurve: 0.1,  // cât de „U” e cuticula
  tipRound: 0.22,     // rotunjirea vârfului (squoval)
  dome: 0.035,        // bombarea unghiei peste deget
  lift: 0.014,        // grosimea / distanța față de piele
}

const halfLen = FINGER.length / 2

/** Înălțimea pielii degetului deasupra punctului (x, y). */
function fingerTopZ(x: number, y: number): number {
  const R = FINGER.radius
  const dy = Math.max(0, y - halfLen) // pe capacul sferic de la vârf
  const r2 = R * R - x * x - dy * dy
  return Math.sqrt(Math.max(r2, 0)) * FINGER.flatten
}

/** Punctul de pe unghie pentru (u, t), în coordonatele degetului. */
export function nailPoint(u: number, t: number, target = new THREE.Vector3()): THREE.Vector3 {
  const s = 2 * u - 1 // -1 … 1
  const yMin = NAIL.cuticleY + NAIL.cuticleCurve * s * s
  const yMax = NAIL.cuticleY + NAIL.length - NAIL.tipRound * (1 - Math.sqrt(Math.max(1 - s * s, 0)))
  const y = yMin + (yMax - yMin) * t
  const x = s * (NAIL.width / 2) * (1 + 0.07 * t)

  // Pe deget unghia urmează pielea; marginea liberă (peste vârful degetului) continuă ușor în jos.
  const ySkin = Math.min(y, halfLen + 0.05)
  let z = fingerTopZ(x, ySkin) + NAIL.lift + NAIL.dome * (1 - s * s)
  if (y > ySkin) z -= 0.35 * (y - ySkin) * (y - ySkin)

  return target.set(x, y, z)
}

/** Normala suprafeței (prin diferențe finite) — pentru orientarea pensulei. */
export function nailNormal(u: number, t: number, target = new THREE.Vector3()): THREE.Vector3 {
  const e = 0.01
  const p = nailPoint(u, t)
  const du = nailPoint(Math.min(u + e, 1), t).sub(p)
  const dt = nailPoint(u, Math.min(t + e, 1)).sub(p)
  return target.crossVectors(du, dt).normalize()
}

/** Geometria unghiei; atributul uv = (u, t) e folosit de shader-ul care întinde oja. */
export function createNailGeometry(segU = 48, segT = 64): THREE.BufferGeometry {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const p = new THREE.Vector3()

  for (let j = 0; j <= segT; j++) {
    const t = j / segT
    for (let i = 0; i <= segU; i++) {
      const u = i / segU
      nailPoint(u, t, p)
      positions.push(p.x, p.y, p.z)
      uvs.push(u, t)
    }
  }

  const row = segU + 1
  for (let j = 0; j < segT; j++) {
    for (let i = 0; i < segU; i++) {
      const a = j * row + i
      const b = a + 1
      const c = a + row
      const d = c + 1
      indices.push(a, b, d, a, d, c)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}
