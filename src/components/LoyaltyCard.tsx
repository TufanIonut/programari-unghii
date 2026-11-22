import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import type { LoyaltyCard as Card } from '../api/loyalty'
import { formatShort } from '../lib/dates'
import { visitsLeftText } from '../lib/loyalty'

/** Bulinele cardului: pline = vizite bifate, ultima = recompensa. */
export function StampDots({ stamps, required, light = false }: { stamps: number; required: number; light?: boolean }) {
  return (
    <span
      className={`stamp-dots${light ? ' is-light' : ''}`}
      role="img"
      aria-label={`${stamps} din ${required} vizite bifate`}
    >
      {Array.from({ length: required }, (_, i) => (
        <i key={i} className={`${i < stamps ? 'is-on' : ''}${i === required - 1 ? ' is-reward' : ''}`} />
      ))}
    </span>
  )
}

/** Cardul de fidelitate al clientei: QR-ul pe care îl scanează salonul + vizitele bifate. */
export function LoyaltyCard({ card }: { card: Card }) {
  const [svg, setSvg] = useState<string | null>(null)

  useEffect(() => {
    QRCode.toString(card.qrText, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#4a2b39', light: '#fbf7f3' },
    })
      .then(setSvg)
      .catch(() => setSvg(null))
  }, [card.qrText])

  return (
    <div className="loyalty-card">
      <div className="loyalty-card-info">
        <span className="tile-label">Card de fidelitate</span>
        <p className="loyalty-reward">
          La a {card.required}-a vizită: <em>{card.reward}</em>
        </p>
        <StampDots stamps={card.stamps} required={card.required} light />
        <p className="loyalty-left">{visitsLeftText(card)}</p>
        {card.completed > 0 && (
          <p className="loyalty-meta">
            {card.completed === 1 ? 'Ai umplut deja un card.' : `Ai umplut deja ${card.completed} carduri.`}
          </p>
        )}
        {card.visits.length > 0 && <p className="loyalty-meta">Ultima vizită: {formatShort(card.visits[0])}</p>}
      </div>

      <figure className="loyalty-qr">
        {/* SVG generat local de biblioteca qrcode, din codul cardului */}
        {svg ? <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="qr qr-empty" />}
        <figcaption>
          <strong>{card.code}</strong>
          <small>Arată codul la salon, la fiecare vizită.</small>
        </figcaption>
      </figure>
    </div>
  )
}
