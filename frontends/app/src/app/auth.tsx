import * as WebBrowser from 'expo-web-browser';

import { Loading } from '@/ui/primitives';

/**
 * Where Zitadel sends the browser back after sign-in (cargotrack://auth
 * on phones, /auth on the web). On the web this page runs in the sign-in
 * popup and hands the result to the window that opened it.
 */
WebBrowser.maybeCompleteAuthSession();

export default function AuthRedirect() {
  return <Loading />;
}
