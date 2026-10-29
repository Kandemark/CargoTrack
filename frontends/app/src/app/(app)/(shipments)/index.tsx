import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { can, isDriverOnly } from '@/auth/permissions';
import { useShipments, type Shipment } from '@/features/shipments/queries';
import { StatusLabel } from '@/features/shipments/StatusLabel';
import { useI18n } from '@/i18n';
import { dateTime } from '@/ui/format';
import { Button, Chip, Notice, Row, Text } from '@/ui/primitives';
import { maxContentWidth, space, usePalette } from '@/ui/theme';

/** Shipments for shippers and carriers; "Jobs" for drivers, who see only theirs. */
export default function ShipmentsList() {
  const { t } = useI18n();
  const c = usePalette();
  const { roles } = useAuth();
  const [filter, setFilter] = useState<'active' | 'done'>('active');
  const list = useShipments(filter);
  const driver = isDriverOnly(roles);
  const shipments = list.data?.pages.flatMap((p) => p.shipments) ?? [];

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.paper }}>
      <ScrollView
        contentContainerStyle={{ padding: space.m, gap: space.l, width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}>
        <Text variant="title">{driver ? t('jobs') : t('shipments')}</Text>

        {can(roles, 'shipments.manage') ? (
          <Button title={t('book')} onPress={() => router.push('/shipments/new')} />
        ) : null}

        <View style={{ flexDirection: 'row', gap: space.s }}>
          <Chip label={t('active')} selected={filter === 'active'} onPress={() => setFilter('active')} />
          <Chip label={t('finished')} selected={filter === 'done'} onPress={() => setFilter('done')} />
        </View>

        {list.isError ? (
          <View style={{ gap: space.s }}>
            <Notice tone="danger">{t('couldNotLoad')}</Notice>
            <Button kind="quiet" title={t('retry')} onPress={() => void list.refetch()} />
          </View>
        ) : list.isPending ? null : shipments.length === 0 ? (
          <Text tone="muted">{driver ? t('noJobs') : t('noShipments')}</Text>
        ) : (
          <View>
            {shipments.map((s, i) => (
              <ShipmentRow key={s.id} shipment={s} last={i === shipments.length - 1} />
            ))}
          </View>
        )}

        {list.hasNextPage ? (
          <Button kind="quiet" title={t('more')} busy={list.isFetchingNextPage} onPress={() => void list.fetchNextPage()} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ShipmentRow({ shipment: s, last }: { shipment: Shipment; last: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(`/shipments/${s.id}`)}>
      <Row last={last}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading">
            {s.origin_name} → {s.destination_name}
          </Text>
          <Text variant="caption" tone="muted">
            {s.tracking_number}
            {s.reference ? ` · ${s.reference}` : ''} · {dateTime(s.pickup_at)}
          </Text>
        </View>
        <StatusLabel status={s.status} />
      </Row>
    </Pressable>
  );
}
