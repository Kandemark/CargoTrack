/**
 * mobile/components/DriverMap.tsx
 *
 * MapLibre map centered on the driver's current position with a pulsing dot.
 * Used in the driver dashboard and track tab.
 */
import { View, Text, StyleSheet } from 'react-native'
import MapLibreGL from '@maplibre/maplibre-react-native'

interface Props {
  latitude: number
  longitude: number
  driverName?: string
  truckPlate?: string
}

// Default map center — Nairobi, Kenya
const DEFAULT_CENTER: [number, number] = [36.8219, -1.2921]

export default function DriverMap({ latitude, longitude, driverName, truckPlate }: Props) {
  const coordinates: [number, number] = latitude && longitude ? [longitude, latitude] : DEFAULT_CENTER

  return (
    <View style={styles.container}>
      <MapLibreGL.MapView
        style={styles.map}
        mapStyle="https://demotiles.maplibre.org/style.json"
        logoEnabled={false}
        attributionEnabled={false}
      >
        <MapLibreGL.Camera
          centerCoordinate={coordinates}
          zoomLevel={12}
          animationMode="flyTo"
          animationDuration={800}
        />

        {/* Driver position dot */}
        <MapLibreGL.PointAnnotation
          id="driver-position"
          coordinate={coordinates}
        >
          <View style={styles.dotOuter}>
            <View style={styles.dotInner} />
          </View>
        </MapLibreGL.PointAnnotation>
      </MapLibreGL.MapView>

      {/* Overlay info bar */}
      <View style={styles.overlay}>
        {driverName && (
          <Text style={styles.name}>{driverName}</Text>
        )}
        {truckPlate && (
          <Text style={styles.plate}>{truckPlate}</Text>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  dotOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 45, 94, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#f5801e',
    borderWidth: 2,
    borderColor: '#fff',
  },
  overlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(15, 45, 94, 0.85)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  name: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  plate: {
    color: '#93b4d8',
    fontSize: 12,
    marginTop: 2,
  },
})
