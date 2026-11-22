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
}

export interface AdminAppointment {
  id: string
  start: string
  end: string
  clientName: string
  email: string
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
  dayAppointments: (date: string) => api<AdminAppointment[]>(`/api/admin/appointments?date=${date}`),
}
