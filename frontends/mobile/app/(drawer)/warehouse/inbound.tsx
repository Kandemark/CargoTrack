import ShipmentQueue from '@/components/ShipmentQueue'

/** Shipments on the way in to the warehouse. */
export default function Screen() {
  return (
    <ShipmentQueue
      title="Inbound"
      statuses={['IN_TRANSIT', 'DELAYED', 'CUSTOMS']}
      emptyIcon="arrow-down-circle-outline"
      emptyTitle="Nothing on the way"
      emptyBody="Shipments heading to the warehouse appear here."
    />
  )
}
