import type { ReactNode } from 'react'
import { MONTHS, WEEKDAYS_SHORT, formatLong, monthCells, parseISO, todayISO } from '../lib/dates'

export type DayVariant = 'available' | 'full' | 'closed' | 'off' | 'past'

export interface DayInfo {
  variant: DayVariant
  /** text mic sub număr, ex. „3 ore libere” (ascuns pe telefon) */
  hint?: string
  disabled?: boolean
}

interface CalendarProps {
  year: number
  month: number
  getDay: (iso: string) => DayInfo
  selected?: string | null
  onSelect: (iso: string) => void
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
  loading?: boolean
  legend?: ReactNode
}

/** Calendar lunar mare. Nu știe nimic despre API: părintele spune cum arată fiecare zi. */
export function Calendar({
  year, month, getDay, selected, onSelect, canPrev, canNext, onPrev, onNext, loading, legend,
}: CalendarProps) {
  const today = todayISO()

  return (
    <div className="calendar" aria-busy={loading}>
      <div className="calendar-head">
        <button type="button" className="calendar-nav" onClick={onPrev} disabled={!canPrev} aria-label="Luna anterioară">
          ‹
        </button>
        <h2 className="calendar-title">
          {MONTHS[month]} <span>{year}</span>
        </h2>
        <button type="button" className="calendar-nav" onClick={onNext} disabled={!canNext} aria-label="Luna următoare">
          ›
        </button>
      </div>

      <div className="calendar-grid" role="grid">
        {WEEKDAYS_SHORT.map((w) => (
          <div key={w} className="calendar-weekday" role="columnheader">
            {w}
          </div>
        ))}

        {monthCells(year, month).map((iso, i) => {
          if (!iso) return <div key={`blank-${i}`} className="calendar-blank" aria-hidden="true" />

          const info = getDay(iso)
          const isSelected = iso === selected
          const classes = [
            'calendar-day',
            `is-${info.variant}`,
            isSelected && 'is-selected',
            iso === today && 'is-today',
          ].filter(Boolean).join(' ')

          return (
            <button
              key={iso}
              type="button"
              className={classes}
              disabled={info.disabled}
              aria-pressed={isSelected}
              aria-label={`${formatLong(iso)}${info.hint ? ` — ${info.hint}` : ''}`}
              onClick={() => onSelect(iso)}
            >
              <span className="calendar-day-number">{parseISO(iso).day}</span>
              {info.variant === 'off' && <span className="calendar-day-x" aria-hidden="true">✕</span>}
              {info.hint && <span className="calendar-day-hint">{info.hint}</span>}
            </button>
          )
        })}
      </div>

      {legend && <div className="calendar-legend">{legend}</div>}
    </div>
  )
}

export function LegendItem({ variant, children }: { variant: DayVariant; children: ReactNode }) {
  return (
    <span className="legend-item">
      <span className={`legend-swatch is-${variant}`} aria-hidden="true" />
      {children}
    </span>
  )
}
