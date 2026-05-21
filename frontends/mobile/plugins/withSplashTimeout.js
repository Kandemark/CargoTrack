/**
 * Expo config plugin: Adds a native 10-second safety timeout to the splash screen.
 *
 * If the Metro bundler is unreachable and the JS bundle never loads,
 * the splash auto-dismisses instead of hanging forever on Android.
 * Does nothing on iOS (iOS has its own system-level splash timeout).
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const TIMEOUT_MS = 10000;

const IMPORT_HANDLER = 'import android.os.Handler';
const IMPORT_LOOPER = 'import android.os.Looper';
const GENERATED_END_MARKER = '// @generated end expo-splashscreen';
const TIMEOUT_COMMENT = '    // @generated begin expo-splashscreen-timeout — auto-hide splash if JS never loads';

function withSplashTimeout(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const filePath = path.join(
        config.modRequest.platformProjectRoot,
        'app', 'src', 'main', 'java', 'com', 'cargotrack', 'app',
        'MainActivity.kt',
      );

      if (!fs.existsSync(filePath)) {
        console.warn('[withSplashTimeout] MainActivity.kt not found at', filePath);
        return config;
      }

      let contents = fs.readFileSync(filePath, 'utf8');

      if (contents.includes(TIMEOUT_COMMENT)) {
        return config;
      }

      // Add imports if missing
      if (!contents.includes(IMPORT_HANDLER)) {
        contents = contents.replace(
          'import android.os.Bundle',
          'import android.os.Bundle\n' + IMPORT_HANDLER + '\n' + IMPORT_LOOPER,
        );
      }

      // Append timeout right after the expo-splashscreen generated block
      const timeoutBlock = [
        '',
        TIMEOUT_COMMENT,
        `    Handler(Looper.getMainLooper()).postDelayed({ SplashScreenManager.hide() }, ${TIMEOUT_MS}L)`,
        '    // @generated end expo-splashscreen-timeout',
      ].join('\n');

      if (contents.includes(GENERATED_END_MARKER)) {
        contents = contents.replace(
          GENERATED_END_MARKER,
          GENERATED_END_MARKER + '\n' + timeoutBlock,
        );
      } else {
        // Fallback: inject after registerOnActivity call
        contents = contents.replace(
          /(SplashScreenManager\.registerOnActivity\(this\))/,
          '$1' + '\n' + timeoutBlock,
        );
      }

      fs.writeFileSync(filePath, contents, 'utf8');
      return config;
    },
  ]);
}

module.exports = withSplashTimeout;
