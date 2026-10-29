/**
 * Build-time configuration.
 *
 * Every value is baked into the build from EXPO_PUBLIC_* variables (see
 * eas.json). Nothing is discovered at runtime, and nothing points at a
 * developer's laptop: a phone build that cannot reach its servers is the
 * bug this app was rebuilt to avoid, so app.config.ts refuses to build a
 * release with missing or local addresses, and the app shows a clear
 * "not configured" screen instead of hanging if one ever slips through.
 */

export type Config = {
  /** Base URL of the CargoTrack core API, e.g. https://api.example.com */
  apiUrl: string;
  /** Zitadel instance, e.g. https://cargotrack-abc123.zitadel.cloud */
  oidcIssuer: string;
  /** Client ID of the Zitadel application (PKCE, no secret). */
  oidcClientId: string;
  /** Zitadel project ID; requested as the token audience. */
  oidcProjectId: string;
};

const raw = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? '',
  oidcIssuer: process.env.EXPO_PUBLIC_OIDC_ISSUER ?? '',
  oidcClientId: process.env.EXPO_PUBLIC_OIDC_CLIENT_ID ?? '',
  oidcProjectId: process.env.EXPO_PUBLIC_OIDC_PROJECT_ID ?? '',
};

/** Returns the problems with a configuration; empty when it is usable. */
export function configProblems(c: Config, allowLocal: boolean): string[] {
  const problems: string[] = [];
  for (const [key, value] of Object.entries(c)) {
    if (!value) problems.push(`${key} is not set`);
  }
  for (const key of ['apiUrl', 'oidcIssuer'] as const) {
    const value = c[key];
    if (!value) continue;
    if (!/^https?:\/\//.test(value)) {
      problems.push(`${key} must be a full URL`);
    } else if (!allowLocal && !value.startsWith('https://')) {
      problems.push(`${key} must use https`);
    } else if (!allowLocal && /\/\/(localhost|127\.|10\.|192\.168\.)/.test(value)) {
      problems.push(`${key} points at a local machine`);
    }
  }
  return problems;
}

export const config: Config = {
  apiUrl: raw.apiUrl.replace(/\/+$/, ''),
  oidcIssuer: raw.oidcIssuer.replace(/\/+$/, ''),
  oidcClientId: raw.oidcClientId,
  oidcProjectId: raw.oidcProjectId,
};

/** Empty when the build is usable; otherwise shown on the not-configured screen. */
export const problems = configProblems(config, __DEV__);
