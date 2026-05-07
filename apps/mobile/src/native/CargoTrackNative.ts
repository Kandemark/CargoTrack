/**
 * TypeScript bridge to CargoTrack native Kotlin modules.
 *
 * These methods call through React Native's NativeModules bridge
 * to the Kotlin implementation in android/cargotrack-native/.
 */
import { NativeModules, Platform } from 'react-native';

const { CargoTrackNative } = NativeModules;

export interface Shipment {
  id: string;
  trackingNumber: string;
  status: string;
  origin: string;
  destination: string;
  carrierName?: string;
  estimatedArrival?: string;
  lastUpdated: number;
}

export interface TrackingEventInput {
  id?: string;
  shipmentId: string;
  eventType: string;
  location: string;
  notes?: string;
  timestamp: number;
}

const native = {
  /** Start continuous GPS tracking (foreground service on Android). */
  startGpsTracking() {
    if (Platform.OS === 'android' && CargoTrackNative) {
      CargoTrackNative.startGpsTracking();
    }
  },

  /** Stop GPS tracking foreground service. */
  stopGpsTracking() {
    if (Platform.OS === 'android' && CargoTrackNative) {
      CargoTrackNative.stopGpsTracking();
    }
  },

  /** Prompt biometric authentication. Returns true if successful. */
  async authenticateBiometric(): Promise<boolean> {
    if (Platform.OS === 'android' && CargoTrackNative) {
      return CargoTrackNative.authenticateBiometric();
    }
    return false;
  },

  /** Check if biometric auth is available on this device. */
  async isBiometricAvailable(): Promise<boolean> {
    if (Platform.OS === 'android' && CargoTrackNative) {
      return CargoTrackNative.isBiometricAvailable();
    }
    return false;
  },

  /** Get all shipments stored in the offline Room database. */
  async getOfflineShipments(): Promise<Shipment[]> {
    if (Platform.OS === 'android' && CargoTrackNative) {
      return CargoTrackNative.getOfflineShipments();
    }
    return [];
  },

  /** Record a tracking event to the offline database for later sync. */
  async recordTrackingEvent(event: TrackingEventInput): Promise<void> {
    if (Platform.OS === 'android' && CargoTrackNative) {
      return CargoTrackNative.recordTrackingEvent(event);
    }
  },

  /** Trigger immediate data sync with the backend API. */
  async syncNow(): Promise<boolean> {
    if (Platform.OS === 'android' && CargoTrackNative) {
      return CargoTrackNative.syncNow();
    }
    return false;
  },
};

export default native;
