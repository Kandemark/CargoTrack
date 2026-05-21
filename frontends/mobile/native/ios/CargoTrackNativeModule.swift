import Foundation

/// React Native native module exposing platform-specific capabilities for iOS.
/// Mirrors the Kotlin CargoTrackNativeModule API surface.
@objc(CargoTrackNative)
class CargoTrackNativeModule: NSObject {

  @objc
  func startGpsTracking() {
    // TODO: Start CoreLocation significant-change monitoring
  }

  @objc
  func stopGpsTracking() {
    // TODO: Stop CoreLocation monitoring
  }

  @objc
  func authenticateBiometric(_ resolve: @escaping RCTPromiseResolveBlock,
                              rejecter reject: @escaping RCTPromiseRejectBlock) {
    // TODO: LAContext.evaluatePolicy for Face ID / Touch ID
    resolve(false)
  }

  @objc
  func isBiometricAvailable(_ resolve: @escaping RCTPromiseResolveBlock,
                             rejecter reject: @escaping RCTPromiseRejectBlock) {
    // TODO: LAContext.canEvaluatePolicy
    resolve(false)
  }

  @objc
  func getOfflineShipments(_ resolve: @escaping RCTPromiseResolveBlock,
                            rejecter reject: @escaping RCTPromiseRejectBlock) {
    // TODO: Read from local CoreData / SQLite store
    resolve([])
  }

  @objc
  func recordTrackingEvent(_ event: [String: Any],
                            resolver resolve: @escaping RCTPromiseResolveBlock,
                            rejecter reject: @escaping RCTPromiseRejectBlock) {
    // TODO: Write tracking event to local store
    resolve(nil)
  }

  @objc
  func syncNow(_ resolve: @escaping RCTPromiseResolveBlock,
                rejecter reject: @escaping RCTPromiseRejectBlock) {
    // TODO: Trigger BGTaskScheduler background sync
    resolve(false)
  }

  @objc
  static func requiresMainQueueSetup() -> Bool { false }
}
