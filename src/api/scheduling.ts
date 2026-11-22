import { api } from './client'

export type DayStatus = 'available' | 'full' | 'closed' | 'day_off' | 'past' | 'too_far'

export interface DayAvailability {
  date: string
  status: DayStatus
  slots: string[]
}

export interface Availability {
  durationMinutes: number
  days: DayAvailability[]
}

export interface Appointment {
  id: string
  date: string
  start: string
  end: string
  status: 'booked' | 'cancelled'
  serviceName?: string | null
  price?: number | null
}

export interface AdminAppointment {
  id: string
  start: string
  end: string
  clientId: string
  clientName: string
  email: string
  serviceName?: string | null
  price?: number | null
  details?: string | null
}

export interface SalonSettings {
  workStart: string
  workEnd: string
  workDays: number[]
  breakMinutes: number
  minNoticeHours: number
  bookingWindowDays: number
  defaultDurationMinutes: number
}

export interface OpenSlot {
  id: string
  date: string
  start: string
  end: string
}

export interface DayOff {
  date: string
  note: string | null
}

export const schedulingApi = {
  availability: (from: string, to: string) => api<Availability>(`/api/availability?from=${from}&to=${to}`),

  book: (date: string, time: string) => api<Appointment>('/api/appointments', { method: 'POST', body: { date, time } }),
  mine: () => api<Appointment[]>('/api/appointments/mine'),
  cancel: (id: string) => api<void>(`/api/appointments/${id}`, { method: 'DELETE' }),

  settings: () => api<SalonSettings>('/api/admin/settings'),
  saveSettings: (s: SalonSettings) => api<SalonSettings>('/api/admin/settings', { method: 'PUT', body: s }),
  daysOff: (from: string, to: string) => api<DayOff[]>(`/api/admin/days-off?from=${from}&to=${to}`),
  setDayOff: (date: string, note?: string) => api<void>(`/api/admin/days-off/${date}`, { method: 'PUT', body: { note } }),
  removeDayOff: (date: string) => api<void>(`/api/admin/days-off/${date}`, { method: 'DELETE' }),
  slots: (from: string, to: string) => api<OpenSlot[]>(`/api/admin/slots?from=${from}&to=${to}`),
  addSlot: (date: string, start: string, end: string) =>
    api<OpenSlot>('/api/admin/slots', { method: 'POST', body: { date, start, end } }),
  deleteSlot: (id: string) => api<void>(`/api/admin/slots/${id}`, { method: 'DELETE' }),
  applyStandard: (from: string, to: string) =>
    api<{ daysFilled: number }>('/api/admin/slots/apply-standard', { method: 'POST', body: { from, to } }),
  dayAppointments: (date: string) => api<AdminAppointment[]>(`/api/admin/appointments?date=${date}`),
}
