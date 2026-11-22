// Etichetele în română pentru codurile din fișă (aceleași coduri ca în backend: ProfileOptions).

import type { ClientProfile, EstimateLine, Pricing, WorkEstimate } from '../api/profile'

export interface Option {
  value: string
  label: string
  hint?: string
}

export const GROWTH: Option[] = [
  { value: 'rapid', label: 'Repede', hint: 'Le pilesc des' },
  { value: 'normal', label: 'Normal' },
  { value: 'lent', label: 'Încet', hint: 'Cresc greu' },
]

export const NAIL_BED: Option[] = [
  { value: 'scurt', label: 'Scurt' },
  { value: 'mediu', label: 'Mediu' },
  { value: 'lung', label: 'Lung' },
]

export const CUTICLES: Option[] = [
  { value: 'fine', label: 'Fine' },
  { value: 'normale', label: 'Normale' },
  { value: 'groase', label: 'Groase / uscate' },
]

export const MATERIAL: Option[] = [
  { value: 'niciunul', label: 'Nimic', hint: 'Unghii naturale' },
  { value: 'semipermanent', label: 'Semipermanent' },
  { value: 'gel', label: 'Gel' },
  { value: 'acril', label: 'Acril' },
]

export const LENGTH: Option[] = [
  { value: 'scurta', label: 'Scurtă' },
  { value: 'medie', label: 'Medie' },
  { value: 'lunga', label: 'Lungă' },
  { value: 'foarte_lunga', label: 'Foarte lungă' },
]

export const labelOf = (options: Option[], value: string) => options.find((o) => o.value === value)?.label ?? value

/**
 * Aceeași regulă ca WorkEstimator din backend, pentru previzualizarea live din fișă
 * (și pentru serverul simulat din demo). Serverul rămâne sursa de adevăr la programare.
 */
export function estimateWork(p: ClientProfile, pricing: Pricing): WorkEstimate | null {
  const service = pricing.services.find((s) => s.code === p.service)
  if (!service) return null
  const extras = new Map(pricing.extras.map((e) => [e.code, e]))
  const lines: EstimateLine[] = [{ name: service.name, minutes: service.minutes, price: service.price }]

  const add = (code: string, count = 1, label?: string) => {
    const e = extras.get(code)
    if (!e || count <= 0) return
    lines.push({ name: label ?? e.name, minutes: e.minutes * count, price: e.price * count })
  }

  if (p.existingMaterial !== 'niciunul' && p.service !== 'intretinere') add('indepartare')

  if (p.service === 'gel' || p.service === 'intretinere') {
    if (p.length === 'lunga') add('lungime_lunga')
    else if (p.length === 'foarte_lunga') add('lungime_xl')
  }

  if (p.wantsDesign) {
    const extraColors = Math.max(0, p.colors - 1)
    add('culoare', extraColors, extraColors === 1 ? '1 culoare în plus' : `${extraColors} culori în plus`)
    const models = p.models.filter((m) => m.trim()).length
    add('model', models, models === 1 ? '1 model' : `${models} modele`)
  }

  const raw = lines.reduce((s, l) => s + l.minutes, 0)
  return {
    serviceName: service.name,
    minutes: Math.ceil(raw / 10) * 10,
    price: lines.reduce((s, l) => s + l.price, 0),
    lines,
    summary: lines.map((l) => l.name).join(', '),
  }
}

export const EMPTY_PROFILE: ClientProfile = {
  age: null,
  growth: '',
  nailBed: '',
  cuticles: '',
  existingMaterial: '',
  service: '',
  length: '',
  wantsDesign: false,
  colors: 1,
  models: [],
  notes: null,
  preferredDays: [],
  preferredFrom: null,
  preferredTo: null,
}
