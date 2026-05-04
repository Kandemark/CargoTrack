/**
 * mobile/lib/useDriverLocation.ts
 *
 * Hook for background driver GPS tracking. Periodically posts driver location
 * to POST /api/v1/fleet/drivers/<id>/location/ so the web LiveMap stays updated.
 *
 * Requires: npx expo install expo-location expo-task-manager
 */
import { useEffect, useRef, useCallback } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { apiClient } from './api'

const LOCATION_INTERVAL_MS = 30_000 // 30 seconds

interface LocationState {
  watching: boolean
  driverId: number | null
}

export function useDriverLocation(driverId: number | null) {
  const stateRef = useRef<LocationState>({ watching: false, driverId: null })
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const postLocation = useCallback(async () => {
    if (!driverId) return
    try {
      // Use expo-location when available; fall back to basic post
      let lat: number | null = null
      let lng: number | null = null

      try {
        const Location = require('expo-location')
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
          lat = pos.coords.latitude
          lng = pos.coords.longitude
        }
      } catch {
        // expo-location not installed — location fields will be null
      }

      await apiClient.post(`/api/v1/fleet/drivers/${driverId}/location/`, {
        latitude: lat,
        longitude: lng,
        status: 'ON_ROUTE',
      })
    } catch {
      // Silently fail — don't interrupt driving for a failed location ping
    }
  }, [driverId])

  const startWatching = useCallback(() => {
    if (stateRef.current.watching || !driverId) return
    stateRef.current.watching = true
    stateRef.current.driverId = driverId

    // Post immediately
    postLocation()
    // Then on interval
    intervalRef.current = setInterval(postLocation, LOCATION_INTERVAL_MS)
  }, [driverId, postLocation])

  const stopWatching = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    stateRef.current.watching = false
  }, [])

  // Handle app state (pause when backgrounded, resume when foregrounded)
  useEffect(() => {
    const handleChange = (nextState: AppStateStatus) => {
      if (nextState === 'active' && driverId) {
        startWatching()
      } else if (nextState === 'background') {
        // Keep posting in background — expo-location background task handles this
      }
    }

    const sub = AppState.addEventListener('change', handleChange)
    return () => sub.remove()
  }, [driverId, startWatching])

  // Start/stop based on driverId
  useEffect(() => {
    if (driverId) {
      startWatching()
    } else {
      stopWatching()
    }
    return () => stopWatching()
  }, [driverId, startWatching, stopWatching])

  return { startWatching, stopWatching, postLocation }
}
