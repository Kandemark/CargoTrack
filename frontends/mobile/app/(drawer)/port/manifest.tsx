import ShipmentQueue from '@/components/ShipmentQueue'

/** Every shipment through the port, for the manifest. */
export default function Screen() {
  return (
    <ShipmentQueue
      title="Manifests"
      emptyIcon="clipboard-outline"
      emptyTitle="No shipments yet"
      emptyBody="Shipments appear here as they are booked."
    />
  )
}
