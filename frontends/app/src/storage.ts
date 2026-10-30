import * as SecureStore from 'expo-secure-store';

/**
 * Phone storage. Tokens live in the Android Keystore / iOS Keychain via
 * SecureStore. Reads give up after a moment and report "nothing stored",
 * so a slow keystore on a budget phone delays sign-in, never start-up.
 */
const READ_TIMEOUT_MS = 1500;

async function read(key: string): Promise<string | null> {
  try {
    return await Promise.race([
      SecureStore.getItemAsync(key),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), READ_TIMEOUT_MS)),
    ]);
  } catch {
    return null;
  }
}

async function write(key: string, value: string | null): Promise<void> {
  try {
    if (value === null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // A failed write only means signing in again next time.
  }
}

/** Tokens and other secrets. */
export const secrets = {
  get: (key: string) => read(`secret.${key}`),
  set: (key: string, value: string | null) => write(`secret.${key}`, value),
};

/** Preferences such as language. */
export const prefs = {
  get: (key: string) => read(`pref.${key}`),
  set: (key: string, value: string | null) => write(`pref.${key}`, value),
};
