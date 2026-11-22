import { Component, Suspense, lazy, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

// Three.js e mare (~250 kB gzip): îl încărcăm separat, după restul paginii,
// ca să nu întârzie calendarul.
const NailScene = lazy(() => import('./NailScene'))

const POLISH_COLORS = [
  { hex: '#6b3f52', name: 'Prună' },
  { hex: '#e8c4c4', name: 'Roz pudrat' },
  { hex: '#b85c74', name: 'Trandafiriu' },
]
const HEXES = POLISH_COLORS.map((c) => c.hex)

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function usePrefersReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(() => window.matchMedia?.(query).matches ?? false)
  useEffect(() => {
    const mq = window.matchMedia?.(query)
    if (!mq) return
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/** Dacă WebGL cade (driver, context pierdut), afișăm ilustrația statică în loc de o zonă goală. */
class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function StaticNail() {
  return (
    <svg className="nail-fallback" viewBox="0 0 120 160" aria-hidden="true">
      <rect x="38" y="4" width="44" height="46" rx="8" fill="#6B3F52" />
      <rect x="30" y="50" width="60" height="10" rx="3" fill="#6B3F52" />
      <path d="M24 70c0-5.5 4.5-10 10-10h52c5.5 0 10 4.5 10 10v68c0 9-7 16-16 16H40c-9 0-16-7-16-16V70z" fill="#FBF7F3" />
      <path d="M24 96h72v42c0 9-7 16-16 16H40c-9 0-16-7-16-16V96z" fill="#6B3F52" />
    </svg>
  )
}

export function NailHero() {
  const container = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)
  const [webgl] = useState(supportsWebGL)
  const reduced = usePrefersReducedMotion()
  const [current, setCurrent] = useState(0)
  const [requested, setRequested] = useState<{ index: number; nonce: number } | null>(null)

  // ?nailT=2.5 îngheață animația la un moment dat (doar în dezvoltare, pentru capturi).
  const frozenTime = import.meta.env.DEV
    ? (() => {
        const v = new URLSearchParams(window.location.search).get('nailT')
        return v === null ? null : Number(v)
      })()
    : null

  // Nu randăm cât timp scena nu e pe ecran (economie de baterie pe telefon).
  useEffect(() => {
    const el = container.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '100px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const pick = (index: number) => setRequested({ index, nonce: Date.now() })

  return (
    <div className="nail-hero">
      <div ref={container} className="nail-stage">
        {webgl ? (
          <SceneBoundary fallback={<StaticNail />}>
            <Suspense fallback={<div className="nail-loading" aria-hidden="true" />}>
              <NailScene
                colors={HEXES}
                requested={requested}
                onColorChange={setCurrent}
                still={reduced}
                paused={!visible}
                frozenTime={frozenTime}
              />
            </Suspense>
          </SceneBoundary>
        ) : (
          <StaticNail />
        )}
      </div>

      <div className="polish-picker" role="group" aria-label="Alege culoarea ojei din animație">
        {POLISH_COLORS.map((c, i) => (
          <button
            key={c.hex}
            type="button"
            className={`polish-swatch${i === current ? ' is-current' : ''}`}
            style={{ '--swatch': c.hex } as CSSProperties}
            onClick={() => pick(i)}
            aria-pressed={i === current}
            title={c.name}
          >
            <span className="sr-only">{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
