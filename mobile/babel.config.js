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
 */
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo', 'nativewind/babel'],
  }
}
