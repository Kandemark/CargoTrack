import ShipmentQueue from '@/components/ShipmentQueue'

/** Shipments waiting for a truck and driver. */
export default function Screen() {
  return (
    <ShipmentQueue
      title="Dispatch queue"
      statuses={['PENDING']}
      emptyIcon="list-outline"
      emptyTitle="Nothing waiting"
      emptyBody="New shipments that need a truck and driver appear here."
    />
  )
}
