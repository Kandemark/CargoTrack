import { useI18n } from '@/i18n';
import { Text } from '@/ui/primitives';

import type { ShipmentStatus } from './queries';

const tone = {
  booked: 'muted',
  picked_up: 'accent',
  in_transit: 'accent',
  customs: 'warn',
  exception: 'danger',
  delivered: 'ok',
  cancelled: 'faint',
} as const;

/** Status as a word in its colour: never colour alone. */
export function StatusLabel({ status }: { status: ShipmentStatus }) {
  const { t } = useI18n();
  return (
    <Text variant="label" tone={tone[status]}>
      {t(`status_${status}`)}
    </Text>
  );
}
