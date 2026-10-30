import { useBack } from '@/lib/useBack'
import { Empty, ScreenFrame } from '@/components/ui'

/**
 * Vessel arrivals need the port's own schedule (KPA for Mombasa, TPA for
 * Dar es Salaam), which is not connected yet. Until then this says so,
 * rather than showing road shipments as if they were ships.
 */
export default function VesselsScreen() {
  const back = useBack()
  return (
    <ScreenFrame title="Vessel schedule" onBack={back}>
      <Empty
        icon="boat-outline"
        title="Vessel schedule not connected yet"
        body="Ship arrivals will show here once CargoTrack is linked to the port authority's schedule. Containers and manifests already work."
      />
    </ScreenFrame>
  )
}
