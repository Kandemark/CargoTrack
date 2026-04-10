import { create } from 'zustand'
import { alertsApi } from '@/api/alerts'
import type { Alert } from '@/types'

interface AlertState {
  alerts: Alert[]
  unreadCount: number
  isLoading: boolean
  error: string | null

  fetchAlerts: () => Promise<void>
  acknowledgeAlert: (id: number) => Promise<void>
}

export const useAlertStore = create<AlertState>()((set, get) => ({
  alerts: [],
  unreadCount: 0,
  isLoading: false,
  error: null,

  fetchAlerts: async () => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await alertsApi.getAlerts()
      const alerts = data.results
      set({
        alerts,
        unreadCount: alerts.filter((a) => !a.acknowledged).length,
      })
    } catch {
      set({ error: 'Failed to load alerts.' })
    } finally {
      set({ isLoading: false })
    }
  },

  acknowledgeAlert: async (id: number) => {
    try {
      const { data: updated } = await alertsApi.acknowledgeAlert(id)
      const alerts = get().alerts.map((a) => (a.id === id ? updated : a))
      set({
        alerts,
        unreadCount: alerts.filter((a) => !a.acknowledged).length,
      })
    } catch {
      set({ error: 'Failed to acknowledge alert.' })
    }
  },
}))
