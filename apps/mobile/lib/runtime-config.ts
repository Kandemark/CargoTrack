/**
 * runtime-config.ts — API base URL resolution with automatic server discovery.
 *
 * The mobile app probes candidate URLs on startup and picks the first reachable
 * CargoTrack API.  No manual IP configuration is ever needed.
 *
 * Discovery order (parallel probes, first success wins):
 *  1. Previously-saved URL (from a prior successful connection)
 *  2. Metro-derived URL — same LAN IP the device uses to reach the bundler,
 *     but on port 8000 (Django) instead of 8081 (Metro)
 *  3. Android emulator alias — 10.0.2.2:8000 maps to the host's 127.0.0.1
 *  4. Common LAN IPs — quick parallel scan of typical gateway addresses
 *
 * The first URL to respond 200 at /api/health/ is stored and used for all
 * subsequent API calls.  If no candidate responds, the app falls back to
 * the Metro-derived URL and lets the login screen surface the error.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import axios from 'axios'

const API_BASE_URL_KEY = 'cargotrack.api.base_url'
const HEALTH_TIMEOUT = 1500 // ms — LAN is fast; every extra ms keeps user at splash

// ─── URL normalisation ────────────────────────────────────────────────────────

export function normalizeApiBaseUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`
  return withScheme.replace(/\/+$/, '')
}

// ─── Candidate generation ─────────────────────────────────────────────────────

export function resolveDefaultApiBaseUrl(): string {
  // Always prefer the Metro bundler host — it's the same IP the device already
  // talks to, so the API at that IP:8000 is almost certainly correct.
  const hostUri = Constants.expoConfig?.hostUri
  if (hostUri) {
    const host = hostUri.split(':')[0]
    if (Platform.OS === 'android' && (host === 'localhost' || host === '127.0.0.1')) {
      return 'http://10.0.2.2:8000'
    }
    return `http://${host}:8000`
  }

  // Fall back to .env override or sensible defaults
  if (process.env.EXPO_PUBLIC_API_URL) {
    return normalizeApiBaseUrl(process.env.EXPO_PUBLIC_API_URL)
  }

  return Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000'
}

/** Build the set of candidate URLs we should probe on startup. */
function buildCandidates(): string[] {
  const candidates = new Set<string>()

  // Metro-derived (most likely correct — same IP the device already talks to)
  const hostUri = Constants.expoConfig?.hostUri
  let metroHost = ''
  let metroLastOctet = ''
  if (hostUri) {
    metroHost = hostUri.split(':')[0]
    if (metroHost === 'localhost' || metroHost === '127.0.0.1') {
      if (Platform.OS === 'android') {
        candidates.add('http://10.0.2.2:8000')
      } else {
        candidates.add('http://localhost:8000')
      }
    } else {
      candidates.add(`http://${metroHost}:8000`)
      // Also extract the last octet so we can probe it in LAN subnets
      const parts = metroHost.split('.')
      if (parts.length === 4) {
        metroLastOctet = parts[3]
      }
    }
  }

  // Always try emulator alias on Android
  if (Platform.OS === 'android') {
    candidates.add('http://10.0.2.2:8000')
  }
  candidates.add('http://localhost:8000')

  // Include the .env override as a candidate (but after Metro-derived)
  if (process.env.EXPO_PUBLIC_API_URL) {
    candidates.add(normalizeApiBaseUrl(process.env.EXPO_PUBLIC_API_URL))
  }

  // ── LAN scan ─────────────────────────────────────────────────────────────
  // Common suffixes include the gateway (.1), DHCP range (.100-.102), and
  // the Metro host's own last octet (the most likely API IP).
  const lanSuffixes = ['1', '100', '101', '102']
  if (metroLastOctet && !lanSuffixes.includes(metroLastOctet)) {
    lanSuffixes.push(metroLastOctet)
  }

  // Derive the actual subnet from the Metro bundler IP if available.
  const subnetPrefixes: string[] = []
  if (metroHost && metroHost !== 'localhost' && metroHost !== '127.0.0.1') {
    const parts = metroHost.split('.')
    if (parts.length === 4) {
      subnetPrefixes.push(parts.slice(0, 3).join('.'))
    }
  }

  // Common fallback subnets
  subnetPrefixes.push(
    '192.168.1',
    '192.168.0',
    '192.168.8',
    '192.168.100',
    '10.0.0',
    '10.0.1',
    '10.0.2',
    '172.16.0',
  )

  for (const prefix of subnetPrefixes) {
    for (const suf of lanSuffixes) {
      candidates.add(`http://${prefix}.${suf}:8000`)
    }
  }

  return Array.from(candidates)
}

// ─── Health probe ─────────────────────────────────────────────────────────────

async function probeHealth(url: string): Promise<{ url: string; reachable: boolean }> {
  try {
    const res = await axios.get(`${normalizeApiBaseUrl(url)}/api/health/`, {
      timeout: HEALTH_TIMEOUT,
      validateStatus: (s) => s === 200,
    })
    const data = res.data as { service?: string }
    // Confirm it's actually the CargoTrack API
    if (data.service === 'CargoTrack API') {
      return { url: normalizeApiBaseUrl(url), reachable: true }
    }
    return { url, reachable: false }
  } catch {
    return { url, reachable: false }
  }
}

// ─── Discovery ────────────────────────────────────────────────────────────────

let discoveryInProgress: Promise<string> | null = null
let discoveredUrl: string | null = null

/**
 * Discover the CargoTrack API server by probing candidate URLs in parallel.
 *
 * Runs once per process — subsequent calls return the cached result immediately.
 * Candidates are probed in batches to balance speed against flooding the network.
 */
export async function discoverApiServer(): Promise<string> {
  // Return cached result if already discovered this session
  if (discoveredUrl) return discoveredUrl

  // Avoid duplicate concurrent discovery
  if (discoveryInProgress) return discoveryInProgress

  discoveryInProgress = (async () => {
    // ── Phase 0 & 1 in parallel ──────────────────────────────────────────
    // Phase 0: stored URL from a previous session (may be stale/from old network).
    // Phase 1: Metro-derived URL — the device is already talking to Metro at
    //          this IP, so the API at the same IP:8000 is almost certainly correct.
    // We run both in parallel.  If the Metro-derived URL works, it ALWAYS wins
    // over the stored URL because the stored URL could be from a different network.
    const stored = await getStoredApiBaseUrl()

    const metroDerived = resolveDefaultApiBaseUrl()
    const fastCandidates = [
      metroDerived,
      ...(Platform.OS === 'android' ? ['http://10.0.2.2:8000'] : []),
      'http://localhost:8000',
      'http://127.0.0.1:8000',
    ]
    const uniqueFast = [...new Set(fastCandidates)]

    // Run stored-url probe and fast-candidate probes simultaneously
    const storedPromise = stored ? probeHealth(stored) : Promise.resolve(null)
    const fastPromise = Promise.all(uniqueFast.map(probeHealth))

    const [storedResult, fastResults] = await Promise.all([storedPromise, fastPromise])

    // If any fast candidate (especially Metro-derived) works, use it immediately.
    // Metro-derived is the most reliable signal — the device is already connected
    // to this host for the JS bundle.
    const fastHit = fastResults.find((r) => r.reachable)
    if (fastHit) {
      discoveredUrl = fastHit.url
      await saveApiBaseUrl(fastHit.url)
      return fastHit.url
    }

    // Only trust the stored URL if the fast candidates ALL failed AND the stored
    // URL is on the same subnet as Metro (otherwise it's a stale URL from another
    // network that somehow responded — can happen with port forwarding / VPNs).
    if (storedResult?.reachable) {
      // Check if stored URL is on the same subnet as Metro
      const metroHost = Constants.expoConfig?.hostUri?.split(':')[0] ?? ''
      if (metroHost && metroHost !== 'localhost' && metroHost !== '127.0.0.1') {
        const metroSubnet = metroHost.split('.').slice(0, 3).join('.')
        const storedHost = new URL(storedResult.url).hostname
        const storedSubnet = storedHost.split('.').slice(0, 3).join('.')
        if (metroSubnet === storedSubnet) {
          discoveredUrl = storedResult.url
          return storedResult.url
        }
        // Different subnet — skip the stale stored URL, it's from another network
      } else {
        // No Metro info to cross-check; accept stored URL cautiously
        discoveredUrl = storedResult.url
        return storedResult.url
      }
    }

    // ── Phase 2: scan LAN IPs ────────────────────────────────────────────
    const allCandidates = buildCandidates()
    // Filter out what we already tried
    const tried = new Set(uniqueFast.map(normalizeApiBaseUrl))
    if (stored) tried.add(normalizeApiBaseUrl(stored))
    const remaining = allCandidates.filter((c) => !tried.has(normalizeApiBaseUrl(c)))

    // Probe in batches of 8 to avoid overwhelming the network
    const BATCH = 8
    for (let i = 0; i < remaining.length; i += BATCH) {
      const batch = remaining.slice(i, i + BATCH)
      const batchResults = await Promise.all(batch.map(probeHealth))
      const hit = batchResults.find((r) => r.reachable)
      if (hit) {
        discoveredUrl = hit.url
        await saveApiBaseUrl(hit.url)
        return hit.url
      }
    }

    // ── Phase 3: nothing found — fall back to default ────────────────────
    discoveredUrl = resolveDefaultApiBaseUrl()
    return discoveredUrl
  })()

  return discoveryInProgress
}

/** Reset discovery so the next call probes again. Used after user changes server. */
export function resetDiscovery() {
  discoveryInProgress = null
  discoveredUrl = null
}

// ─── Persistence ────────────────────────────────────────────────────────────────

export async function getStoredApiBaseUrl() {
  const value = await AsyncStorage.getItem(API_BASE_URL_KEY)
  return value ? normalizeApiBaseUrl(value) : null
}

export async function saveApiBaseUrl(value: string) {
  const normalized = normalizeApiBaseUrl(value)
  await AsyncStorage.setItem(API_BASE_URL_KEY, normalized)
  return normalized
}

export async function clearStoredApiBaseUrl() {
  await AsyncStorage.removeItem(API_BASE_URL_KEY)
}

// ─── Suggestions (for the server-settings UI) ──────────────────────────────────

export function getSuggestedApiBaseUrls(): string[] {
  return buildCandidates().slice(0, 12)
}
