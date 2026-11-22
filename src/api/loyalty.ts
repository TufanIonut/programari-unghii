import { api } from './client'

export interface LoyaltyCard {
  code: string // „XXXXX-XXXXX”, se poate și tasta
  qrText: string // ce conține QR-ul
  stamps: number // vizite bifate pe cardul curent
  required: number // câte vizite are un card
  reward: string
  completed: number // carduri umplute până acum
  visits: string[] // ultimele zile bifate, cele mai noi primele
}

export interface LoyaltySettings {
  stampsRequired: number
  reward: string
}

export interface ScanResult {
  status: 'stamped' | 'already_today'
  clientId: string
  clientName: string
  stamps: number
  required: number
  reward: string
  completed: number
  completedNow: boolean
}

export const loyaltyApi = {
  card: () => api<LoyaltyCard>('/api/loyalty'),
  scan: (code: string) => api<ScanResult>('/api/admin/loyalty/scan', { method: 'POST', body: { code } }),
  settings: () => api<LoyaltySettings>('/api/admin/loyalty/settings'),
  saveSettings: (s: LoyaltySettings) => api<LoyaltySettings>('/api/admin/loyalty/settings', { method: 'PUT', body: s }),
}
