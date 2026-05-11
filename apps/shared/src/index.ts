// Re-export from the canonical shared-types library used by both web and mobile
export * from '../../../libs/shared-types/api/types'
export * from '../../../libs/shared-types/utils/formatters'
export * from '../../../libs/shared-types/utils/statusColors'

// Mobile-specific native bridge types
export type { Shipment, TrackingEventInput } from './native'
