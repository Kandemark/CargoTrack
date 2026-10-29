/**
 * Browser storage. Tokens are kept for the browser session only
 * (sessionStorage), so a forgotten tab on a shared office computer does
 * not stay signed in for days. Preferences persist in localStorage.
 * Storage can be unavailable (private windows, blocked site data); that
 * only means signing in again.
 */
function store(kind: 'session' | 'local') {
  const backend = (): Storage | null => {
    try {
      return kind === 'session' ? window.sessionStorage : window.localStorage;
    } catch {
      return null;
    }
  };
  return {
    get: async (key: string): Promise<string | null> => {
      try {
        return backend()?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    set: async (key: string, value: string | null): Promise<void> => {
      try {
        if (value === null) backend()?.removeItem(key);
        else backend()?.setItem(key, value);
      } catch {
        // ignore
      }
    },
  };
}

const session = store('session');
const local = store('local');

export const secrets = {
  get: (key: string) => session.get(`secret.${key}`),
  set: (key: string, value: string | null) => session.set(`secret.${key}`, value),
};

export const prefs = {
  get: (key: string) => local.get(`pref.${key}`),
  set: (key: string, value: string | null) => local.set(`pref.${key}`, value),
};
