#!/usr/bin/env bash
# Installs what a local Android build of the mobile app needs, into
# ~/Android/Sdk (no root needed for the SDK itself):
#   - Android command-line tools (from Google)
#   - platform android-36, build-tools 36.0.0, NDK 27.1, CMake 3.22.1
#     (the versions Expo SDK 54 / React Native 0.81 build with)
# Java 17 is a system package; on Arch install it first with
#   sudo pacman -S --needed jdk17-openjdk
# Your default Java is left as it is; builds point JAVA_HOME at 17.
#
# About 5 GB of downloads. Run once per machine:
#   scripts/setup-android-sdk.sh
set -euo pipefail

SDK="${ANDROID_HOME:-$HOME/Android/Sdk}"
JAVA17=/usr/lib/jvm/java-17-openjdk
TOOLS_ZIP_URL=https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip

if [[ ! -x "$JAVA17/bin/java" ]]; then
  echo "Java 17 not found at $JAVA17. On Arch: sudo pacman -S --needed jdk17-openjdk" >&2
  exit 1
fi
export JAVA_HOME="$JAVA17"

if [[ ! -x "$SDK/cmdline-tools/latest/bin/sdkmanager" ]]; then
  echo "Downloading Android command-line tools..."
  tmp="$(mktemp -d)"
  curl -fL --progress-bar -o "$tmp/tools.zip" "$TOOLS_ZIP_URL"
  mkdir -p "$SDK/cmdline-tools"
  unzip -q "$tmp/tools.zip" -d "$tmp"
  rm -rf "$SDK/cmdline-tools/latest"
  mv "$tmp/cmdline-tools" "$SDK/cmdline-tools/latest"
  rm -rf "$tmp"
fi

SDKMANAGER="$SDK/cmdline-tools/latest/bin/sdkmanager"
echo "Accepting Android SDK licences..."
yes | "$SDKMANAGER" --sdk_root="$SDK" --licenses >/dev/null
echo "Installing SDK components (this is the large download)..."
"$SDKMANAGER" --sdk_root="$SDK" \
  "platform-tools" "platforms;android-36" "build-tools;36.0.0" \
  "ndk;27.1.12297006" "cmake;3.22.1"

echo
echo "Android SDK ready at $SDK"
du -sh "$SDK" 2>/dev/null || true
