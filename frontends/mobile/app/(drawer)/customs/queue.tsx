import ShipmentQueue from '@/components/ShipmentQueue'

/** Shipments held at a border for customs clearance. */
export default function Screen() {
  return (
    <ShipmentQueue
      title="Clearance queue"
      statuses={['CUSTOMS']}
      emptyIcon="hourglass-outline"
      emptyTitle="Nothing at customs"
      emptyBody="Shipments waiting for clearance appear here."
    />
  )
}
