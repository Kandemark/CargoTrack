/**
 * mobile/lib/useNetworkStatus.ts — Real-time network connectivity hook.
 *
 * Provides isConnected / isInternetReachable flags and the connection type
 * (wifi, cellular, etc.) so the UI can show offline banners or disable
 * features that require the network.
 */
import { useState, useEffect } from 'react'
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'

interface NetworkStatus {
  isConnected: boolean
  isInternetReachable: boolean | null
  type: string
  isMetered: boolean
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: true,
    type: 'unknown',
    isMetered: false,
  })

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setStatus({
        isConnected: !!state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
        isMetered: !!((state as any).isConnectionExpensive),
      })
    })
    return () => unsubscribe()
  }, [])

  return status
}
