import { createDashboardApi } from '@shared/api/dashboard'
import { apiClient } from './client'

export const dashboardApi = createDashboardApi(apiClient)
