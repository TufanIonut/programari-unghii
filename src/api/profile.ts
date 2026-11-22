import { api, type User } from './client'

export interface ClientProfile {
  age: number | null
  growth: string
  nailBed: string
  cuticles: string
  existingMaterial: string
  service: string
  length: string
  wantsDesign: boolean
  colors: number
  models: string[]
  notes: string | null
  preferredDays: number[]
  preferredFrom: string | null
  preferredTo: string | null
}

export interface EstimateLine {
  name: string
  minutes: number
  price: number
}

export interface WorkEstimate {
  serviceName: string
  minutes: number
  price: number
  lines: EstimateLine[]
  summary: string
}

export interface ProfileResponse {
  profile: ClientProfile & { updatedAt: string }
  estimate: WorkEstimate
}

export interface PriceItem {
  code: string
  name: string
  minutes: number
  price: number
}

export interface Pricing {
  services: PriceItem[]
  extras: PriceItem[]
}

export interface AdminClient {
  user: User
  profile: (ClientProfile & { updatedAt: string }) | null
  estimate: WorkEstimate | null
}

export const profileApi = {
  /** null dacă clienta nu are încă fișă */
  get: () =>
    api<ProfileResponse>('/api/profile').catch((err) => {
      if (err?.status === 404) return null
      throw err
    }),
  save: (profile: ClientProfile, consent: boolean) =>
    api<ProfileResponse>('/api/profile', { method: 'PUT', body: { ...profile, consent } }),

  pricing: () => api<Pricing>('/api/pricing'),
  savePricing: (pricing: Pricing) => api<Pricing>('/api/admin/pricing', { method: 'PUT', body: pricing }),
  adminClient: (id: string) => api<AdminClient>(`/api/admin/clients/${id}`),
}
