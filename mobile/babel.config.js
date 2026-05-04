/**
 * mobile/babel.config.js
 *
 * Babel configuration for the CargoTrack Expo app.
 *
 * Why 'nativewind/babel' is required:
 *   NativeWind v4 uses a jsxImportSource transform so that the `className`
 *   prop is recognised on React Native host components.  Without this plugin,
 *   every `className="..."` is silently ignored and the app is completely
 *   unstyled.  The plugin proxies to react-native-css-interop/babel which
 *   also wires up the react-native-worklets Babel plugin needed for
 *   Reanimated 4 worklet detection.
 *
 * Preset load order matters:
 *   1. babel-preset-expo   — base transforms (JSX, TS, module resolution)
 *   2. nativewind/babel    — jsxImportSource → react-native-css-interop
 *                            + worklets detection for Reanimated 4
 *
 * NOTE: nativewind/babel returns { plugins: [...] } so it is a PRESET,
 * not a plugin — it must go in `presets`, not `plugins`.
 *
 * Why expoRouterBabelPlugin is added explicitly:
 *   babel-preset-expo gates expoRouterBabelPlugin behind hasModule('expo-router'),
 *   which calls require.resolve() from babel-preset-expo's own install location.
 *   In this monorepo babel-preset-expo is hoisted to root node_modules, but
 *   expo-router lives in mobile/node_modules — so that resolve fails silently and
 *   the plugin is never registered. Without it, process.env.EXPO_ROUTER_APP_ROOT
 *   is never replaced with a string literal, causing Metro's require.context
 *   validator to throw a SyntaxError on expo-router/_ctx.android.js.
 */
module.exports = function (api) {
  api.cache(true)

  // Bypass the hasModule('expo-router') guard in babel-preset-expo.
  const { expoRouterBabelPlugin } = require('babel-preset-expo/build/expo-router-plugin')

  return {
    presets: ['babel-preset-expo', 'nativewind/babel'],
    plugins: [
      expoRouterBabelPlugin,
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './',
            '@shared': '../shared',
          },
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },
      ],
    ],
  }
}
