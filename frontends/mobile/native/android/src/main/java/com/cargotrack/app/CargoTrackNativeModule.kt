package com.cargotrack.app

import com.facebook.react.bridge.*

/**
 * React Native native module exposing platform-specific capabilities:
 * GPS foreground service, biometric authentication, offline Room database,
 * and background data sync.
 */
class CargoTrackNativeModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "CargoTrackNative"

  @ReactMethod
  fun startGpsTracking() {
    // TODO: Start foreground service for continuous GPS collection
  }

  @ReactMethod
  fun stopGpsTracking() {
    // TODO: Stop GPS foreground service
  }

  @ReactMethod
  fun authenticateBiometric(promise: Promise) {
    // TODO: Biometric prompt via BiometricPrompt API
    promise.resolve(false)
  }

  @ReactMethod
  fun isBiometricAvailable(promise: Promise) {
    // TODO: Check BiometricManager.canAuthenticate()
    promise.resolve(false)
  }

  @ReactMethod
  fun getOfflineShipments(promise: Promise) {
    // TODO: Query Room database, return shipment list as WritableArray
    promise.resolve(Arguments.createArray())
  }

  @ReactMethod
  fun recordTrackingEvent(event: ReadableMap, promise: Promise) {
    // TODO: Insert tracking event into Room database
    promise.resolve(null)
  }

  @ReactMethod
  fun syncNow(promise: Promise) {
    // TODO: Trigger WorkManager OneTimeWorkRequest for immediate sync
    promise.resolve(false)
  }
}
