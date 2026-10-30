import ShipmentQueue from '@/components/ShipmentQueue'

/** Delivered cargo now held at the warehouse. */
export default function Screen() {
  return (
    <ShipmentQueue
      title="Inventory"
      statuses={['DELIVERED']}
      emptyIcon="file-tray-stacked-outline"
      emptyTitle="Nothing in stock"
      emptyBody="Delivered cargo appears here."
    />
  )
}
