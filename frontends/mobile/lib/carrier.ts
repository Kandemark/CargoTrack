/**
 * Who moves a shipment, as the user should read it: "Own fleet" when
 * their company carries its own cargo, the carrier's name otherwise.
 */
export function carrierLabel(carrier: string | null | undefined, ownOrg: string | null | undefined): string {
  if (!carrier) return 'No carrier yet'
  if (ownOrg && carrier.trim().toLowerCase() === ownOrg.trim().toLowerCase()) return 'Own fleet'
  return carrier
}
