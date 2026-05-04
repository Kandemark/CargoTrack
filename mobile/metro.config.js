const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

const projectRoot   = __dirname
const workspaceRoot = path.resolve(projectRoot, '..')   // repo root (monorepo)
const sharedRoot    = path.resolve(workspaceRoot, 'shared')

// With npm workspaces, expo-router is hoisted to root node_modules.
// getDefaultConfig() looks for it in mobile/node_modules and never finds it,
// so it never sets EXPO_ROUTER_APP_ROOT. Babel then can't replace
// process.env.EXPO_ROUTER_APP_ROOT with a static string in _ctx.android.js,
// causing Metro to reject the non-static require.context() call.
if (!process.env.EXPO_ROUTER_APP_ROOT) {
  process.env.EXPO_ROUTER_APP_ROOT = path.resolve(projectRoot, 'app')
}

let config = getDefaultConfig(projectRoot)

// Watch shared/ and the root node_modules so Metro picks up packages that
// npm workspaces hoisted out of mobile/node_modules into the repo root.
config.watchFolders = [
  sharedRoot,
  path.resolve(workspaceRoot, 'node_modules'),
]

// Resolve @shared/* → ../shared/*  (mirrors tsconfig.json paths)
// Also include root node_modules in the resolver search path so that
// packages hoisted by npm workspaces are visible to Metro.
config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ],
  extraNodeModules: {
    ...config.resolver?.extraNodeModules,
    '@': projectRoot,
    '@shared': sharedRoot,
  },
}

module.exports = withNativeWind(config, { input: './global.css' })
