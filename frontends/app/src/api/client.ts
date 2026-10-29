import createClient, { type Middleware } from 'openapi-fetch';

import { accessToken, endSession } from '@/auth/session';
import { config } from '@/config';
import type { components, paths } from './schema';

/**
 * The typed API client, generated from contracts/openapi/core.v1.yaml
 * (`npm run gen:api`). A change to the contract that breaks a screen is
 * a type error here, not a crash on a phone.
 */
export type Schemas = components['schemas'];

/** The one error shape every core endpoint returns. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

/** True when an action was refused for lack of wallet credit. */
export function isInsufficientCredit(err: unknown): err is ApiError {
  return err instanceof ApiError && err.code === 'insufficient_credit';
}

const auth: Middleware = {
  async onRequest({ request }) {
    const token = await accessToken();
    if (token) request.headers.set('Authorization', `Bearer ${token}`);
    return request;
  },
  async onResponse({ response }) {
    // The core rejected our token: the session is over.
    if (response.status === 401) await endSession();
    return response;
  },
};

export const api = createClient<paths>({ baseUrl: config.apiUrl });
api.use(auth);

/**
 * Unwraps an openapi-fetch result: the data on success, an ApiError
 * otherwise, so screens and React Query deal in one error type.
 */
export async function call<T>(
  request: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  let result: { data?: T; error?: unknown; response: Response };
  try {
    result = await request;
  } catch {
    throw new ApiError(0, 'network', 'Could not reach CargoTrack.');
  }
  if (result.response.ok) return result.data as T;
  const e = (result.error ?? {}) as Partial<Schemas['Error']>;
  throw new ApiError(
    result.response.status,
    e.error ?? 'unknown',
    e.message ?? `Request failed (${result.response.status})`,
    (e.details as Record<string, unknown>) ?? {},
  );
}
