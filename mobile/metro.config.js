const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

const projectRoot = __dirname
const sharedRoot  = path.resolve(projectRoot, '../shared')

let config = getDefaultConfig(projectRoot)

// Watch the shared package so Metro picks up changes in ../shared
config.watchFolders = [sharedRoot]

// Resolve @shared/* → ../shared/*  (mirrors tsconfig.json paths)
config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    ...config.resolver?.extraNodeModules,
    '@shared': sharedRoot,
  },
}

module.exports = withNativeWind(config, { input: './global.css' })
