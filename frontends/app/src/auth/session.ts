import { refreshAsync, TokenResponse } from 'expo-auth-session';

import { config } from '@/config';
import { secrets } from '@/storage';

/**
 * The signed-in session, outside React so the API client can use it.
 *
 * Refreshing is single-flight: Zitadel rotates refresh tokens, so two
 * screens refreshing at once would invalidate each other and sign the
 * user out at random. Losing the network never signs anyone out; only
 * Zitadel rejecting the refresh token does.
 */
export type Tokens = {
  accessToken: string;
  refreshToken: string | null;
  /** Epoch milliseconds. */
  expiresAt: number;
  /** Stored at sign-in so refreshing needs no discovery request. */
  tokenEndpoint: string;
};

const KEY = 'tokens';
const REFRESH_MARGIN_MS = 60_000;

let current: Tokens | null = null;
let refreshing: Promise<string | null> | null = null;
const signedOutListeners = new Set<() => void>();

export class OfflineError extends Error {
  constructor() {
    super('offline');
  }
}

export function onSignedOut(listener: () => void): () => void {
  signedOutListeners.add(listener);
  return () => signedOutListeners.delete(listener);
}

/** Reads the stored session. Local only: no network at start-up. */
export async function loadSession(): Promise<boolean> {
  const raw = await secrets.get(KEY);
  if (!raw) return false;
  try {
    const t = JSON.parse(raw) as Tokens;
    if (!t.accessToken || !t.tokenEndpoint) return false;
    if (!t.refreshToken && t.expiresAt < Date.now()) return false;
    current = t;
    return true;
  } catch {
    return false;
  }
}

export async function startSession(response: TokenResponse, tokenEndpoint: string): Promise<void> {
  current = toTokens(response, tokenEndpoint, null);
  await secrets.set(KEY, JSON.stringify(current));
}

export async function endSession(): Promise<void> {
  current = null;
  refreshing = null;
  await secrets.set(KEY, null);
  signedOutListeners.forEach((l) => l());
}

/**
 * A valid access token, refreshed first if it is about to expire.
 * Throws OfflineError when a refresh is needed but the network is down.
 */
export async function accessToken(): Promise<string | null> {
  if (!current) return null;
  if (current.expiresAt - REFRESH_MARGIN_MS > Date.now()) return current.accessToken;
  if (!current.refreshToken) {
    await endSession();
    return null;
  }
  refreshing ??= refresh(current).finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function refresh(t: Tokens): Promise<string | null> {
  try {
    const response = await refreshAsync(
      { clientId: config.oidcClientId, refreshToken: t.refreshToken! },
      { tokenEndpoint: t.tokenEndpoint },
    );
    current = toTokens(response, t.tokenEndpoint, t.refreshToken);
    await secrets.set(KEY, JSON.stringify(current));
    return current.accessToken;
  } catch (err) {
    if (isRejected(err)) {
      await endSession();
      return null;
    }
    throw new OfflineError();
  }
}

function toTokens(r: TokenResponse, tokenEndpoint: string, previousRefresh: string | null): Tokens {
  const issuedAt = (r.issuedAt ?? Math.floor(Date.now() / 1000)) * 1000;
  return {
    accessToken: r.accessToken,
    // Zitadel may or may not rotate; keep the old one if none came back.
    refreshToken: r.refreshToken ?? previousRefresh,
    expiresAt: issuedAt + (r.expiresIn ?? 300) * 1000,
    tokenEndpoint,
  };
}

/** True when the identity provider refused the refresh token itself. */
function isRejected(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code ?? '';
  return code === 'invalid_grant' || code === 'invalid_client' || code === 'unauthorized_client';
}
