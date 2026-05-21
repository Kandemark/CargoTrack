/**
 * mobile/lib/offlineSync.ts — Offline-first mutation queue with persistent storage.
 *
 * When the device is offline, mutations are queued to AsyncStorage and
 * replayed in FIFO order when connectivity returns. Each queued mutation
 * stores the Axios config (method, url, data) so it can be replayed exactly.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'
import { apiClient } from './api'

const QUEUE_KEY = 'cargotrack_offline_mutation_queue'
const MAX_QUEUE_SIZE = 100

interface QueuedMutation {
  id: string
  method: 'post' | 'patch' | 'put' | 'delete'
  url: string
  data?: unknown
  createdAt: string
}

// ── Queue management ──────────────────────────────────────────────────────────

export async function getOfflineQueue(): Promise<QueuedMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

async function saveQueue(queue: QueuedMutation[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export async function enqueueMutation(mutation: Omit<QueuedMutation, 'id' | 'createdAt'>): Promise<void> {
  const queue = await getOfflineQueue()
  if (queue.length >= MAX_QUEUE_SIZE) {
    // Drop oldest mutations first to prevent unbounded storage growth
    queue.splice(0, queue.length - MAX_QUEUE_SIZE + 1)
  }
  queue.push({
    ...mutation,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  })
  await saveQueue(queue)
}

export async function removeFromQueue(id: string): Promise<void> {
  const queue = await getOfflineQueue()
  await saveQueue(queue.filter(m => m.id !== id))
}

export async function getQueueSize(): Promise<number> {
  const queue = await getOfflineQueue()
  return queue.length
}

// ── Sync engine ──────────────────────────────────────────────────────────────

let isSyncing = false

export async function syncOfflineQueue(): Promise<{ succeeded: number; failed: number }> {
  if (isSyncing) return { succeeded: 0, failed: 0 }
  isSyncing = true
  const result = { succeeded: 0, failed: 0 }

  try {
    const queue = await getOfflineQueue()
    if (queue.length === 0) return result

    const remaining: QueuedMutation[] = []

    for (const mutation of queue) {
      try {
        await apiClient.request({
          method: mutation.method,
          url: mutation.url,
          data: mutation.data,
          timeout: 15_000,
        })
        result.succeeded++
      } catch {
        remaining.push(mutation)
        result.failed++
      }
    }

    await saveQueue(remaining)
  } finally {
    isSyncing = false
  }

  return result
}

// ── Network listener ─────────────────────────────────────────────────────────

let unsubscribe: (() => void) | null = null

export function startOfflineSyncListener(): void {
  if (unsubscribe) return

  unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      syncOfflineQueue()
    }
  })
}

export function stopOfflineSyncListener(): void {
  unsubscribe?.()
  unsubscribe = null
}
