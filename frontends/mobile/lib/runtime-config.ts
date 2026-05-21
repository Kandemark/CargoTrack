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
const HEALTH_TIMEOUT_TUNNEL = 3000  // ms — tunnel DNS + TLS + routing overhead
const HEALTH_TIMEOUT_LAN = 1200     // ms — LAN is fast; no need to wait longer

// ─── URL normalisation ────────────────────────────────────────────────────────

/** Returns true when the configured API URL uses HTTPS (production build). */
function isProductionBuild(): boolean {
  const envUrl = process.env.EXPO_PUBLIC_API_URL
  return envUrl ? envUrl.startsWith('https://') : false
}

export function normalizeApiBaseUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  return withScheme.replace(/\/+$/, '')
}

// ─── Candidate generation ─────────────────────────────────────────────────────

export function resolveDefaultApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL
  const isProduction = envUrl ? envUrl.startsWith('https://') : false

  // Always prefer the Metro bundler host in dev; use env URL in production
  const hostUri = Constants.expoConfig?.hostUri
  if (hostUri && !isProduction) {
    const host = hostUri.split(':')[0]
    // localhost works on real Android devices via adb reverse AND on emulators
    // (modern emulators forward localhost to the host). 10.0.2.2 is kept as a
    // discovery fallback for older emulators where localhost means the emulator itself.
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:8000'
    }
    return `http://${host}:8000`
  }

  // Fall back to .env override or sensible defaults
  if (envUrl) {
    return normalizeApiBaseUrl(envUrl)
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

async function probeHealth(url: string, timeoutMs = HEALTH_TIMEOUT_LAN): Promise<{ url: string; reachable: boolean }> {
  try {
    const normalized = normalizeApiBaseUrl(url)
    const res = await axios.get(`${normalized}/api/health/`, {
      timeout: timeoutMs,
      validateStatus: (s) => s === 200,
      headers: { 'Accept': 'application/json' },
    })
    const data = res.data as { service?: string; version?: string }
    // Require both the service name AND a version field to prevent trivial spoofing
    if (data.service === 'CargoTrack API' && typeof data.version === 'string') {
      return { url: normalized, reachable: true }
    }
    return { url: normalized, reachable: false }
  } catch {
    return { url: normalizeApiBaseUrl(url), reachable: false }
  }
}

// ─── Discovery ────────────────────────────────────────────────────────────────

let discoveryInProgress: Promise<string> | null = null
let discoveredUrl: string | null = null

/**
 * Discover the CargoTrack API server with smart prioritisation.
 *
 * Phase 0 (tunnel / stored) — the only URLs that can work when the device is
 * off-LAN.  Probe these first with a generous timeout so cloudflared / ngrok
 * have time for DNS + TLS + routing.
 *
 * Phase 1 (LAN) — only runs if Phase 0 fails.  Short timeout because LAN
 * either responds in <200ms or is unreachable.
 */
export async function discoverApiServer(): Promise<string> {
  if (discoveredUrl) return discoveredUrl
  if (discoveryInProgress) return discoveryInProgress

  discoveryInProgress = (async () => {
    const envUrl = process.env.EXPO_PUBLIC_API_URL
      ? normalizeApiBaseUrl(process.env.EXPO_PUBLIC_API_URL)
      : null

    const stored = await getStoredApiBaseUrl()

    // ── Phase 0: Tunnel + stored (off-LAN capable) ─────────────────────────
    // Probe env URL and stored URL first with generous timeout — these are
    // the only candidates that work when the device is on mobile data or a
    // different network.
    const phase0Candidates = [
      ...(envUrl ? [envUrl] : []),
      ...(stored && stored !== envUrl ? [stored] : []),
    ]
    const unique0 = [...new Set(phase0Candidates)]

    if (unique0.length > 0) {
      const results0 = await Promise.all(unique0.map((url) => probeHealth(url, HEALTH_TIMEOUT_TUNNEL)))
      const hit0 = results0.find((r) => r.reachable)
      if (hit0) {
        discoveredUrl = hit0.url
        await saveApiBaseUrl(hit0.url)
        return hit0.url
      }
    }

    // ── Phase 1: LAN candidates ───────────────────────────────────────────
    // Device is likely on the same LAN as the server.  Short timeout — LAN
    // is fast and we don't want to hang the splash screen.
    const metroDerived = resolveDefaultApiBaseUrl()
    const fastCandidates = [
      metroDerived,
      ...(Platform.OS === 'android' ? ['http://10.0.2.2:8000'] : []),
      'http://localhost:8000',
      'http://127.0.0.1:8000',
    ]
    const uniqueFast = [...new Set(fastCandidates)]

    const phase1Probes = uniqueFast.map((url) => probeHealth(url, HEALTH_TIMEOUT_LAN))
    const results1 = await Promise.all(phase1Probes)
    const hit1 = results1.find((r) => r.reachable)
    if (hit1) {
      discoveredUrl = hit1.url
      await saveApiBaseUrl(hit1.url)
      return hit1.url
    }

    // ── Phase 2: LAN scan (quick batch probe) ─────────────────────────────
    // Only scan when no explicit env URL is configured and not in production.
    // In production the env URL is authoritative and scanning 40+ LAN IPs
    // is both wasteful and a security risk (opens the door to server spoofing).
    if (!envUrl && !isProductionBuild()) {
      const allCandidates = buildCandidates()
      const tried = new Set([
        ...unique0.map(normalizeApiBaseUrl),
        ...uniqueFast.map(normalizeApiBaseUrl),
      ])
      const remaining = allCandidates.filter((c) => !tried.has(normalizeApiBaseUrl(c)))

      const BATCH = 8
      for (let i = 0; i < remaining.length; i += BATCH) {
        const batch = remaining.slice(i, i + BATCH)
        const batchResults = await Promise.all(batch.map((url) => probeHealth(url, HEALTH_TIMEOUT_LAN)))
        const hit = batchResults.find((r) => r.reachable)
        if (hit) {
          discoveredUrl = hit.url
          await saveApiBaseUrl(hit.url)
          return hit.url
        }
      }
    }

    // ── Fallback: env URL (best-effort) or default ────────────────────────
    if (envUrl) {
      discoveredUrl = envUrl
      await saveApiBaseUrl(envUrl)
      return envUrl
    }

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
  const list = buildCandidates()
  // Put the env URL first so it's always visible in the server-settings picker
  if (process.env.EXPO_PUBLIC_API_URL) {
    const envNormalized = normalizeApiBaseUrl(process.env.EXPO_PUBLIC_API_URL)
    if (!list.includes(envNormalized)) {
      list.unshift(envNormalized)
    }
  }
  return list.slice(0, 12)
}
