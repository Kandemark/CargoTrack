/**
 * mobile/babel.config.js
 *
 * Babel configuration for the CargoTrack Expo app.
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
    presets: ['babel-preset-expo'],
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
