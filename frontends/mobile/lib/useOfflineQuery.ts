/**
 * mobile/lib/useOfflineQuery.ts — Offline-aware data fetching hook.
 *
 * Wraps @tanstack/react-query with offline-first semantics:
 *   - Queries serve cached data when offline
 *   - Mutations are queued via offlineSync when the network is unavailable
 *   - Stale-while-revalidate strategy (cache-first, background refresh)
 */
import { useCallback, useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query'
import { useNetworkStatus } from './useNetworkStatus'
import { enqueueMutation, startOfflineSyncListener, stopOfflineSyncListener, getQueueSize } from './offlineSync'
import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import { apiClient } from './api'

// ── Offline query helper ─────────────────────────────────────────────────────

export function useOfflineQuery<TData = unknown>(
  key: string[],
  url: string,
  options?: Partial<UseQueryOptions<TData>>,
) {
  const { isConnected } = useNetworkStatus()

  return useQuery<TData>({
    queryKey: key,
    queryFn: async () => {
      const res: AxiosResponse<TData> = await apiClient.get(url)
      return res.data
    },
    // Serve stale cached data when offline; refetch when back online
    staleTime: 30_000,          // 30s before data is considered stale
    gcTime: 24 * 60 * 60_000,   // Keep in cache for 24h (offline availability)
    networkMode: 'offlineFirst',
    // Don't retry when we know we're offline
    retry: (failureCount, error: any) => {
      if (!isConnected) return false
      if (error?.response?.status === 404) return false
      if (error?.response?.status === 401) return false
      return failureCount < 2
    },
    ...options,
  })
}

// ── Offline mutation helper ──────────────────────────────────────────────────

export function useOfflineMutation<TData = unknown, TVars = unknown>(
  method: 'post' | 'patch' | 'put' | 'delete',
  urlBuilder: (vars: TVars) => string,
  options?: {
    onSuccess?: (data: TData, vars: TVars) => void
    onError?: (error: Error, vars: TVars) => void
    invalidateKeys?: string[][]
  },
) {
  const { isConnected } = useNetworkStatus()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (vars: TVars & { data?: unknown }): Promise<TData> => {
      if (!isConnected) {
        // Queue for later and return optimistic response
        await enqueueMutation({
          method,
          url: urlBuilder(vars),
          data: (vars as any).data,
        })
        return (vars as any).data as TData
      }

      const config: AxiosRequestConfig = {
        method,
        url: urlBuilder(vars),
        data: (vars as any).data,
      }
      const res: AxiosResponse<TData> = await apiClient.request(config)
      return res.data
    },
    onSuccess: (data, vars) => {
      if (options?.invalidateKeys) {
        options.invalidateKeys.forEach(k => queryClient.invalidateQueries({ queryKey: k }))
      }
      options?.onSuccess?.(data, vars)
    },
    onError: (error: Error, vars) => {
      options?.onError?.(error, vars)
    },
  })

  return mutation
}

// ── Offline sync lifecycle hook ──────────────────────────────────────────────

export function useOfflineSyncLifecycle(): {
  queueSize: number
  refreshQueueSize: () => void
} {
  const [queueSize, setQueueSize] = useState(0)

  useEffect(() => {
    startOfflineSyncListener()
    getQueueSize().then(setQueueSize)
    return () => stopOfflineSyncListener()
  }, [])

  const refreshQueueSize = useCallback(() => {
    getQueueSize().then(setQueueSize)
  }, [])

  return { queueSize, refreshQueueSize }
}
