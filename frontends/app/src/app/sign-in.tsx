import {
  exchangeCodeAsync,
  fetchDiscoveryAsync,
  makeRedirectUri,
  useAuthRequest,
  type DiscoveryDocument,
} from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { startSession } from '@/auth/session';
import { config } from '@/config';
import { useI18n } from '@/i18n';
import { Button, Notice, Screen, Text } from '@/ui/primitives';
import { space } from '@/ui/theme';

// Closes the sign-in popup on the web once Zitadel redirects back.
WebBrowser.maybeCompleteAuthSession();

/**
 * Zitadel sign-in with the authorization code flow and PKCE. The app is a
 * public client: there is no secret in it, because anything shipped in an
 * app can be extracted. Discovery runs here, when the user is about to
 * sign in, never during start-up.
 */
const scopes = [
  'openid',
  'profile',
  'email',
  'offline_access',
  // Puts the project in the token audience, which the core requires.
  `urn:zitadel:iam:org:project:id:${config.oidcProjectId}:aud`,
];

/**
 * Fetches Zitadel's discovery document with explicit failure handling;
 * Expo's useAutoDiscovery leaves a failed fetch as an unhandled rejection.
 */
function useDiscovery() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ attempt: number; doc: DiscoveryDocument | null; failed: boolean }>({
    attempt: -1,
    doc: null,
    failed: false,
  });
  useEffect(() => {
    let live = true;
    fetchDiscoveryAsync(config.oidcIssuer).then(
      (doc) => live && setState({ attempt, doc, failed: false }),
      () => live && setState({ attempt, doc: null, failed: true }),
    );
    return () => {
      live = false;
    };
  }, [attempt]);
  const current = state.attempt === attempt;
  return {
    discovery: current ? state.doc : null,
    unreachable: current && state.failed,
    retry: () => setAttempt((n) => n + 1),
  };
}

export default function SignIn() {
  const { t } = useI18n();
  const { markSignedIn } = useAuth();
  const { discovery, unreachable, retry } = useDiscovery();
  const redirectUri = makeRedirectUri({ scheme: 'cargotrack', path: 'auth' });
  const [request, , promptAsync] = useAuthRequest(
    { clientId: config.oidcClientId, redirectUri, scopes, usePKCE: true },
    discovery,
  );
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const signIn = async () => {
    if (!request || !discovery?.tokenEndpoint) return;
    setFailed(false);
    setBusy(true);
    try {
      const result = await promptAsync();
      if (result.type === 'success' && request.codeVerifier) {
        const tokens = await exchangeCodeAsync(
          {
            clientId: config.oidcClientId,
            code: result.params.code,
            redirectUri,
            extraParams: { code_verifier: request.codeVerifier },
          },
          discovery,
        );
        await startSession(tokens, discovery.tokenEndpoint);
        markSignedIn();
        return;
      }
      // Closing the browser is not a failure worth a red message.
      if (result.type === 'error') setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', gap: space.l, minHeight: 480 }}>
        <View style={{ gap: space.s }}>
          <Text variant="display">{t('appName')}</Text>
          <Text variant="heading" tone="muted">
            {t('tagline')}
          </Text>
        </View>
        <Text tone="muted">{t('signInHint')}</Text>
        {failed ? <Notice tone="danger">{t('signInFailed')}</Notice> : null}
        {unreachable ? (
          <View style={{ gap: space.s }}>
            <Notice tone="warn">{t('couldNotLoad')}</Notice>
            <Button kind="quiet" title={t('retry')} onPress={retry} />
          </View>
        ) : null}
        <Button
          title={t('signIn')}
          busy={busy}
          disabled={!request}
          onPress={() => void signIn()}
        />
      </View>
    </Screen>
  );
}
