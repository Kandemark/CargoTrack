import ShipmentQueue from '@/components/ShipmentQueue'

/** Shipments booked and waiting to leave. */
export default function Screen() {
  return (
    <ShipmentQueue
      title="Outbound"
      statuses={['PENDING']}
      emptyIcon="arrow-up-circle-outline"
      emptyTitle="Nothing waiting to leave"
      emptyBody="Booked shipments appear here until they depart."
    />
  )
}
