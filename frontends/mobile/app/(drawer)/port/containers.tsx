import ShipmentQueue from '@/components/ShipmentQueue'

/** Containers at the port waiting for customs. */
export default function Screen() {
  return (
    <ShipmentQueue
      title="Containers at customs"
      statuses={['CUSTOMS']}
      emptyIcon="cube-outline"
      emptyTitle="No containers held"
      emptyBody="Containers waiting for clearance appear here."
    />
  )
}
