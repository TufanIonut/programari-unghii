import { useEffect, useRef } from 'react'
import type { Season } from '../lib/seasons'

/*
 * Decorul de anotimp: câteva frunze, flori, fulgi sau umbrele care cad încet în spatele paginii.
 * Canvas 2D simplu (fără WebGL), sub tot conținutul și fără să prindă click-uri.
 * Cu „reducerea mișcării” activă în sistem desenăm un singur cadru, nemișcat.
 */

type Kind = 'leaf' | 'petal' | 'flower' | 'dot' | 'flake' | 'umbrella'

interface Particle {
  kind: Kind
  x: number
  y: number
  size: number
  vy: number
  amp: number
  freq: number
  phase: number
  rot: number
  spin: number
  flipSpeed: number
  color: string
  accent: string
  alpha: number
}

interface SeasonConfig {
  /** câte particule pe un ecran de 1280×800; pe ecrane mici sunt mai puține */
  count: number
  wind: number
  make: () => Omit<Particle, 'x' | 'y'>
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

const base = (over: Partial<Particle> & Pick<Particle, 'kind' | 'size' | 'color'>): Omit<Particle, 'x' | 'y'> => ({
  vy: 30,
  amp: 30,
  freq: rand(0.5, 1.1),
  phase: rand(0, Math.PI * 2),
  rot: rand(0, Math.PI * 2),
  spin: rand(-1.2, 1.2),
  flipSpeed: rand(0.8, 2.2),
  accent: '#6b3f52',
  alpha: 0.8,
  ...over,
})

const CONFIG: Record<Season, SeasonConfig> = {
  autumn: {
    count: 22,
    wind: 14,
    make: () =>
      base({
        kind: 'leaf',
        size: rand(9, 17),
        color: pick(['#c4774f', '#a8543c', '#d6a35c', '#8a4a3a', '#b9696a']),
        vy: rand(24, 46),
        amp: rand(30, 70),
        spin: rand(-1.6, 1.6),
        alpha: rand(0.65, 0.9),
      }),
  },
  spring: {
    count: 26,
    wind: 8,
    make: () => {
      const flower = Math.random() < 0.25
      return base({
        kind: flower ? 'flower' : 'petal',
        size: flower ? rand(10, 14) : rand(6, 10),
        color: pick(['#e8c4c4', '#dca6ae', '#efcfcf', '#c98a99']),
        accent: '#e2bd6b',
        vy: rand(18, 36),
        amp: rand(25, 55),
        spin: flower ? rand(-0.6, 0.6) : rand(-1.8, 1.8),
        alpha: rand(0.7, 0.95),
      })
    },
  },
  winter: {
    count: 46,
    wind: 4,
    make: () => {
      const flake = Math.random() < 0.28
      return base({
        kind: flake ? 'flake' : 'dot',
        size: flake ? rand(5, 9) : rand(1.6, 4),
        color: pick(['#d9b3b9', '#c99aa6', '#e2c3c6', '#b48595']),
        vy: flake ? rand(18, 32) : rand(22, 52),
        amp: rand(8, 28),
        spin: rand(-0.5, 0.5),
        alpha: rand(0.55, 0.9),
      })
    },
  },
  summer: {
    count: 9,
    wind: 6,
    make: () => {
      const [color, accent] = pick([
        ['#e8c4c4', '#6b3f52'],
        ['#6b3f52', '#e8c4c4'],
        ['#f3e3dc', '#dca6ae'],
        ['#dca6ae', '#fbf7f3'],
      ])
      return base({ kind: 'umbrella', size: rand(13, 21), color, accent, vy: rand(14, 24), amp: rand(18, 40), alpha: 0.9 })
    },
  },
}

// ---------------------------------------------------------------- forme (centrate în 0,0)

function leaf(ctx: CanvasRenderingContext2D, s: number, color: string) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, -s)
  ctx.bezierCurveTo(s * 0.8, -s * 0.55, s * 0.62, s * 0.55, 0, s)
  ctx.bezierCurveTo(-s * 0.62, s * 0.55, -s * 0.8, -s * 0.55, 0, -s)
  ctx.fill()
  // nervura și codița
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'
  ctx.lineWidth = Math.max(0.8, s * 0.08)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(0, -s * 0.8)
  ctx.lineTo(0, s * 1.25)
  for (const y of [-0.35, 0.1]) {
    ctx.moveTo(0, s * (y + 0.25))
    ctx.lineTo(s * 0.38, s * y)
    ctx.moveTo(0, s * (y + 0.25))
    ctx.lineTo(-s * 0.38, s * y)
  }
  ctx.stroke()
}

function petal(ctx: CanvasRenderingContext2D, s: number, color: string) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, s)
  ctx.bezierCurveTo(s * 0.95, s * 0.35, s * 0.6, -s * 0.95, s * 0.14, -s * 0.78)
  ctx.lineTo(0, -s * 0.5) // crestătura de floare de cireș
  ctx.lineTo(-s * 0.14, -s * 0.78)
  ctx.bezierCurveTo(-s * 0.6, -s * 0.95, -s * 0.95, s * 0.35, 0, s)
  ctx.fill()
}

function flower(ctx: CanvasRenderingContext2D, s: number, color: string, center: string) {
  for (let i = 0; i < 5; i++) {
    ctx.save()
    ctx.rotate((i * Math.PI * 2) / 5)
    ctx.translate(0, -s * 0.55)
    petal(ctx, s * 0.55, color)
    ctx.restore()
  }
  ctx.fillStyle = center
  ctx.beginPath()
  ctx.arc(0, 0, s * 0.2, 0, Math.PI * 2)
  ctx.fill()
}

function flake(ctx: CanvasRenderingContext2D, s: number, color: string) {
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1, s * 0.14)
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3
    const c = Math.cos(a)
    const n = Math.sin(a)
    ctx.moveTo(0, 0)
    ctx.lineTo(c * s, n * s)
    // două ramuri mici pe fiecare braț
    const bx = c * s * 0.55
    const by = n * s * 0.55
    for (const side of [-1, 1]) {
      const b = a + side * 0.7
      ctx.moveTo(bx, by)
      ctx.lineTo(bx + Math.cos(b) * s * 0.3, by + Math.sin(b) * s * 0.3)
    }
  }
  ctx.stroke()
}

function umbrella(ctx: CanvasRenderingContext2D, s: number, color: string, stripe: string) {
  // cupola: semicerc cu marginea de jos în valuri
  const canopy = new Path2D()
  canopy.moveTo(-s, 0)
  canopy.arc(0, 0, s, Math.PI, Math.PI * 2)
  for (let i = 3; i >= 0; i--) canopy.arc(-s * 0.75 + i * s * 0.5, 0, s / 4, 0, Math.PI, true)
  canopy.closePath()

  ctx.fillStyle = color
  ctx.fill(canopy)
  ctx.save()
  ctx.clip(canopy)
  ctx.fillStyle = stripe
  for (const x of [-0.25, 0.75]) {
    ctx.beginPath()
    ctx.ellipse(x * s, 0, s * 0.25, s * 1.02, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  // vârful și mânerul
  ctx.strokeStyle = '#6b3f52'
  ctx.lineWidth = Math.max(1.2, s * 0.08)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(0, -s)
  ctx.lineTo(0, -s * 1.15)
  ctx.moveTo(0, 0)
  ctx.lineTo(0, s * 1.15)
  ctx.arc(-s * 0.16, s * 1.15, s * 0.16, 0, Math.PI)
  ctx.stroke()
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle, x: number, t: number) {
  ctx.save()
  ctx.globalAlpha = p.alpha
  ctx.translate(x, p.y)
  if (p.kind === 'umbrella') {
    // se leagănă ca o parașută
    ctx.rotate(Math.sin(t * p.freq + p.phase) * 0.28)
  } else {
    ctx.rotate(p.rot)
  }
  if (p.kind === 'leaf' || p.kind === 'petal') {
    // se întoarce în aer: o turtim pe orizontală
    const c = Math.cos(t * p.flipSpeed + p.phase)
    ctx.scale(Math.sign(c || 1) * Math.max(0.15, Math.abs(c)), 1)
  }
  switch (p.kind) {
    case 'leaf':
      leaf(ctx, p.size, p.color)
      break
    case 'petal':
      petal(ctx, p.size, p.color)
      break
    case 'flower':
      flower(ctx, p.size, p.color, p.accent)
      break
    case 'flake':
      flake(ctx, p.size, p.color)
      break
    case 'umbrella':
      umbrella(ctx, p.size, p.color, p.accent)
      break
    default:
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(0, 0, p.size, 0, Math.PI * 2)
      ctx.fill()
  }
  ctx.restore()
}

// ---------------------------------------------------------------- componenta

export function SeasonalBackdrop({ season }: { season: Season }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const config = CONFIG[season]
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let w = 0
    let h = 0
    let particles: Particle[] = []
    const margin = 40

    const spawn = (anywhere: boolean): Particle => ({
      ...config.make(),
      x: rand(-margin, w + margin),
      y: anywhere ? rand(-margin, h) : rand(-margin * 3, -margin),
    })

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const density = Math.min(1, Math.max(0.45, (w * h) / (1280 * 800)))
      const n = Math.round(config.count * density)
      while (particles.length < n) particles.push(spawn(true))
      particles.length = n
    }

    let t = 0
    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      for (const p of particles) drawParticle(ctx, p, p.x + Math.sin(t * p.freq + p.phase) * p.amp, t)
    }

    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000) // după un tab ascuns nu sar toate deodată
      last = now
      t += dt
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.y += p.vy * dt
        p.x += config.wind * dt
        p.rot += p.spin * dt
        if (p.y > h + margin * 2) particles[i] = spawn(false)
        else if (p.x > w + margin * 2) p.x = -margin * 2
      }
      draw()
      raf = requestAnimationFrame(tick)
    }

    resize()
    if (still) draw()
    else raf = requestAnimationFrame(tick)

    const onResize = () => {
      resize()
      if (still) draw()
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      particles = []
    }
  }, [season])

  return <canvas ref={ref} className="season-canvas" aria-hidden="true" />
}
