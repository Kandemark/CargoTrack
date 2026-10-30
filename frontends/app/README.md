<div align="center">

# CargoTrack App

**One codebase for web, Android and iOS, with the same features on every platform.**

[Structure](#structure) ·
[Start-up rules](#start-up-rules) ·
[Development](#development) ·
[Release builds](#release-builds) ·
[Checks](#checks)

</div>

---

## Overview

The app is built with Expo Router on React Native and React Native Web. Data, API calls, permissions and business rules are shared by every platform, so a feature cannot exist on the web and be missing on a phone. Screens may differ where it serves users better: a screen with a `.web.tsx` sibling uses that file on the web.

| | Phones | Web |
|---|---|---|
| Navigation | Native bottom tabs (Material on Android), at most five, chosen by role | Sidebar on wide screens, bottom bar on narrow ones |
| Token storage | Android Keystore / iOS Keychain (`expo-secure-store`) | Session storage: cleared when the browser session ends |
| Languages | English and Swahili, following the phone's language; switchable in Account | Same |

## Structure

```
src/
  app/              Routes (Expo Router). Every file is a screen.
    _layout.tsx       Start-up, providers, signed-in / signed-out routing
    sign-in.tsx       Zitadel sign-in (authorization code + PKCE)
    top-up.tsx        M-Pesa top-up, also opened after an HTTP 402
    (app)/            Signed-in area: tabs on phones, sidebar on web
  api/
    schema.d.ts       Generated from contracts/openapi/core.v1.yaml; do not edit
    client.ts         Typed client, auth header, one ApiError type
  auth/             Session, token refresh, sign-out
  features/         Data hooks per area (wallet, ...)
  i18n/             English and Swahili strings; a missing translation is a type error
  ui/               Theme, primitives, formatting
  config.ts         Build-time configuration and its validation
  storage.ts        Phone storage; storage.web.ts for the browser
```

## Start-up rules

The previous app was installed on phones as a development build pointing at a laptop, so it never started. These rules keep that from happening again:

1. **Release builds point at hosted servers.** `app.config.ts` refuses to build a preview or production release when an address is missing, uses plain HTTP, or points at a local machine.
2. **Nothing remote before the first screen.** Start-up reads only local storage, with a deadline; there are no network calls or font downloads.
3. **The splash screen always hides**, when the first screen is laid out or, at the latest, after a backstop timer.
4. **A misconfigured build explains itself** on screen instead of hanging, and a crashing screen shows a retry instead of a blank page.
5. **Native modules match the SDK.** CI runs `expo-doctor`; a mismatch fails the build.

## Development

```sh
npm ci
cp .env.example .env.local     # fill in API and Zitadel addresses
npx expo start                 # Expo Go on a phone, or press w for web
```

Previewing on a phone over USB, without Wi-Fi:

```sh
adb reverse tcp:8081 tcp:8081
npx expo start --localhost
```

Development goes through Expo Go only; there is no development build profile, so a build that depends on a computer cannot reach a phone.

### API types

The API types come from the contract. After changing [`contracts/openapi/core.v1.yaml`](../../contracts/openapi/core.v1.yaml):

```sh
npm run gen:api
```

The generator runs pinned to its own TypeScript version, so it does not depend on the app's toolchain.

## Release builds

Builds run on Expo Application Services (EAS); no Android Studio or Xcode is needed.

| Profile | Output | Use |
|---|---|---|
| `preview` | APK, installed directly | Testing on real phones |
| `production` | Android App Bundle | Google Play |

Server addresses are set per environment in the Expo dashboard (`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_OIDC_ISSUER`, `EXPO_PUBLIC_OIDC_CLIENT_ID`, `EXPO_PUBLIC_OIDC_PROJECT_ID`), not in the repository.

```sh
npx eas-cli@latest build --platform android --profile preview
```

### Zitadel application

Create a **Native** application with **PKCE** and no client secret, and register these redirect URIs:

| Platform | Redirect URI |
|---|---|
| Android and iOS | `cargotrack://auth` |
| Web | `https://<web app domain>/auth` |

The project must have **Assert Roles on Authentication** enabled, and the application **Auth Token Type: JWT**.

## Checks

Run before pushing; CI runs the same on every pull request:

| Check | Command |
|---|---|
| Types | `npx tsc --noEmit` |
| Lint | `npx eslint .` |
| API types match the contract | `npm run gen:api`, then no diff in `src/api/schema.d.ts` |
| Dependencies match the Expo SDK | `npx expo-doctor` |
| Release bundles compile | `npm run check:bundle` |
