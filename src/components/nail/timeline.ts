// Cronologia unei „manichiuri”: trei pensule (mijloc, stânga, dreapta), apoi luciul.
// Totul e o funcție pură de timp, ca un cadru să poată fi reprodus exact (?nailT=2.5).

export const CYCLE = 7.4

/** Fiecare trăsătură: centrul pe lățime (u), jumătatea lățimii benzii, începutul și durata. */
export const STROKES = [
  { u: 0.5, half: 0.2, start: 0.9, dur: 1.1 },
  { u: 0.19, half: 0.2, start: 2.45, dur: 1.0 },
  { u: 0.81, half: 0.2, start: 3.9, dur: 1.0 },
] as const

const T_START = 0.05 // pensula pornește puțin după cuticulă
const T_END = 1.08   // și iese peste vârf ca să acopere marginea
const REST: BrushPose = { u: 1.32, t: 0.62, lift: 1.05, contact: 0 }
const RETURN_START = 4.9
const RETURN_END = 5.8
const GLINT_START = 6.0
const GLINT_END = 7.0

export interface BrushPose {
  u: number
  t: number
  lift: number      // distanța deasupra unghiei
  contact: number   // 0…1, cât de apăsată e pensula (turtește perii)
}

export interface FrameState {
  brush: BrushPose
  /** cât a avansat fiecare trăsătură, ca „t” al frontului de ojă (sub T_START = nepictat) */
  fronts: [number, number, number]
  glint: number     // poziția reflexiei care trece peste ojă la final (-1 = inactiv)
  painted: boolean  // toate trăsăturile s-au terminat
}

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1)
const ease = (x: number) => x * x * (3 - 2 * x)
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const mix = (a: number, b: number, k: number) => a + (b - a) * k

/** Mutare între două poziții cu un arc în sus (pensula se ridică între trăsături). */
function travel(from: BrushPose, to: BrushPose, k: number, arc: number): BrushPose {
  const e = easeInOut(clamp01(k))
  return {
    u: mix(from.u, to.u, e),
    t: mix(from.t, to.t, e),
    lift: mix(from.lift, to.lift, e) + Math.sin(Math.PI * e) * arc,
    contact: 0,
  }
}

const strokeStart = (i: number): BrushPose => ({ u: STROKES[i].u, t: T_START, lift: 0, contact: 0 })
const strokeEnd = (i: number): BrushPose => ({ u: STROKES[i].u, t: T_END, lift: 0.04, contact: 0 })

export function frameAt(time: number): FrameState {
  const c = ((time % CYCLE) + CYCLE) % CYCLE

  const fronts = STROKES.map((s) => mix(T_START, T_END, ease(clamp01((c - s.start) / s.dur)))) as FrameState['fronts']
  const painted = c >= STROKES[2].start + STROKES[2].dur

  let brush: BrushPose
  const active = STROKES.findIndex((s) => c >= s.start && c < s.start + s.dur)

  if (active >= 0) {
    const s = STROKES[active]
    const k = (c - s.start) / s.dur
    // apasă la început, alunecă, se ridică ușor la final
    const contact = Math.min(clamp01(k / 0.12), clamp01((1 - k) / 0.1))
    brush = { u: s.u + Math.sin(k * Math.PI) * 0.015, t: fronts[active], lift: (1 - contact) * 0.05, contact }
  } else if (c < STROKES[0].start) {
    brush = travel(REST, strokeStart(0), c / STROKES[0].start, 0.1)
  } else if (c < STROKES[1].start) {
    const from = STROKES[0].start + STROKES[0].dur
    brush = travel(strokeEnd(0), strokeStart(1), (c - from) / (STROKES[1].start - from), 0.32)
  } else if (c < STROKES[2].start) {
    const from = STROKES[1].start + STROKES[1].dur
    brush = travel(strokeEnd(1), strokeStart(2), (c - from) / (STROKES[2].start - from), 0.32)
  } else if (c < RETURN_END) {
    brush = travel(strokeEnd(2), REST, (c - RETURN_START) / (RETURN_END - RETURN_START), 0.15)
  } else {
    // în repaus pensula „respiră” puțin, ca scena să nu pară înghețată
    brush = { ...REST, lift: REST.lift + Math.sin(c * 1.6) * 0.03 }
  }

  const g = (c - GLINT_START) / (GLINT_END - GLINT_START)
  const glint = g >= 0 && g <= 1 ? mix(-0.3, 1.3, easeInOut(g)) : -1

  return { brush, fronts, glint, painted }
}

/** Cadrul static (pentru „reduced motion”): unghia complet pictată, pensula în repaus. */
export const STILL_TIME = RETURN_END + 0.05
