import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, loadSession, useAuth } from '@/auth/AuthProvider';
import { problems } from '@/config';
import { I18nProvider, useI18n, type Language } from '@/i18n';
import { prefs } from '@/storage';
import { Button, Screen, Text } from '@/ui/primitives';
import { usePalette } from '@/ui/theme';

/*
 * Start-up rules, because the previous app hung on its splash screen:
 * 1. Before the first screen only local storage is read, with a deadline.
 *    No network, no fonts to download.
 * 2. The splash screen hides as soon as the first screen is laid out, and
 *    a backstop timer hides it regardless.
 * 3. A build without server addresses says so instead of hanging.
 */
const BOOT_DEADLINE_MS = 2500;
const SPLASH_BACKSTOP_MS = 4000;

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
const backstop = setTimeout(() => void SplashScreen.hideAsync().catch(() => undefined), SPLASH_BACKSTOP_MS);

type Boot = { signedIn: boolean; language: Language | null };

async function boot(): Promise<Boot> {
  const local = Promise.all([loadSession(), prefs.get('language')]).then(([signedIn, language]) => ({
    signedIn,
    language: language === 'en' || language === 'sw' ? (language as Language) : null,
  }));
  const deadline = new Promise<Boot>((resolve) =>
    setTimeout(() => resolve({ signedIn: false, language: null }), BOOT_DEADLINE_MS),
  );
  return Promise.race([local, deadline]).catch(() => ({ signedIn: false, language: null }));
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15_000, refetchOnWindowFocus: false },
  },
});

export default function RootLayout() {
  const [booted, setBooted] = useState<Boot | null>(null);
  const scheme = useColorScheme();

  useEffect(() => {
    void boot().then(setBooted);
  }, []);

  const hideSplash = useCallback(() => {
    clearTimeout(backstop);
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  if (!booted) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
        <I18nProvider initial={booted.language}>
          <View style={{ flex: 1 }} onLayout={hideSplash}>
            {problems.length > 0 ? (
              <NotConfigured />
            ) : (
              <QueryClientProvider client={queryClient}>
                <AuthProvider initial={booted.signedIn ? 'signedIn' : 'signedOut'}>
                  <Routes />
                </AuthProvider>
              </QueryClientProvider>
            )}
          </View>
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function Routes() {
  const { status } = useAuth();
  const signedIn = status === 'signedIn';
  return (
    // Redirect targets are explicit: left to itself the router picks the
    // first allowed screen, which would be the /auth hand-off page.
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn} redirectTo="/sign-in">
        <Stack.Screen name="(app)" />
        <Stack.Screen name="top-up" options={{ presentation: 'modal', headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn} redirectTo="/">
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Screen name="auth" />
    </Stack>
  );
}

function NotConfigured() {
  const { t } = useI18n();
  return (
    <Screen>
      <Text variant="title">{t('notConfiguredTitle')}</Text>
      <Text tone="muted">{t('notConfiguredBody')}</Text>
      {__DEV__ ? <Text variant="caption" tone="faint">{problems.join('\n')}</Text> : null}
    </Screen>
  );
}

/** Shown instead of a white screen when a screen throws. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const c = usePalette();
  return (
    <View style={{ flex: 1, backgroundColor: c.paper, justifyContent: 'center', padding: 24, gap: 16 }}>
      <Text variant="title">Something went wrong</Text>
      <Text tone="muted">{__DEV__ ? error.message : 'Please try again.'}</Text>
      <Button title="Try again" onPress={retry} />
    </View>
  );
}
