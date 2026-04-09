import { createShipmentsApi } from '@shared/api/shipments'
import { apiClient } from './client'

export const shipmentsApi = createShipmentsApi(apiClient)
