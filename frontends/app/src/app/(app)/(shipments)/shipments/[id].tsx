import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { can } from '@/auth/permissions';
import {
  nextStatuses,
  useAddEvent,
  useMoveShipment,
  useShipment,
  useShipmentEvents,
  type ShipmentEvent,
  type ShipmentStatus,
} from '@/features/shipments/queries';
import { StatusLabel } from '@/features/shipments/StatusLabel';
import { useI18n } from '@/i18n';
import { dateTime } from '@/ui/format';
import { Button, Field, Loading, Notice, Row, Screen, Text } from '@/ui/primitives';
import { space } from '@/ui/theme';

export default function ShipmentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const { roles } = useAuth();
  const shipment = useShipment(id);
  const events = useShipmentEvents(id);
  const move = useMoveShipment(id);
  const addEvent = useAddEvent(id);
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (shipment.isPending) return <Loading />;
  if (shipment.isError) {
    return (
      <Screen>
        <Notice tone="danger">{t('couldNotLoad')}</Notice>
      </Screen>
    );
  }
  const s = shipment.data;
  const canTrack = can(roles, 'shipments.track');
  const moves = nextStatuses[s.status].filter((next) => next !== 'cancelled' || can(roles, 'shipments.manage'));
  const fail = (err: unknown) => setError(err instanceof ApiError ? err.message : t('couldNotLoad'));

  const doMove = (next: ShipmentStatus) => {
    const go = () => {
      setError(null);
      move.mutate({ status: next, location: location || undefined, note: note || undefined }, {
        onSuccess: () => {
          setLocation('');
          setNote('');
        },
        onError: fail,
      });
    };
    if (next !== 'cancelled') return go();
    if (Platform.OS === 'web') {
      if (window.confirm(t('confirmCancel'))) go();
      return;
    }
    Alert.alert(t('cancel'), t('confirmCancel'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('status_cancelled'), style: 'destructive', onPress: go },
    ]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: s.tracking_number }} />

      <View style={{ gap: space.s }}>
        <StatusLabel status={s.status} />
        <Text variant="title">
          {s.origin_name} → {s.destination_name}
        </Text>
        <Text tone="muted">
          {s.origin_country} → {s.destination_country}
          {s.reference ? ` · ${s.reference}` : ''}
        </Text>
      </View>

      <View>
        <Detail label={t('pickup')} value={s.picked_up_at ? dateTime(s.picked_up_at) : dateTime(s.pickup_at)} />
        <Detail label={t('deliverBy')} value={s.delivered_at ? dateTime(s.delivered_at) : dateTime(s.deliver_by)} />
        <Detail label={t('cargo')} value={[s.cargo_description, `${s.weight_kg} kg`, `${s.pieces} ×`].filter(Boolean).join(' · ')} last />
      </View>

      {canTrack && moves.length > 0 ? (
        <View style={{ gap: space.m }}>
          <Text variant="label" tone="muted">
            {t('move')}
          </Text>
          <Field label={t('location')} hint={t('locationHint')} value={location} onChangeText={setLocation} />
          <Field label={t('note')} value={note} onChangeText={setNote} />
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <View style={{ gap: space.s }}>
            {moves.map((next) => (
              <Button
                key={next}
                kind={next === 'cancelled' ? 'quiet' : 'primary'}
                title={t(`status_${next}`)}
                busy={move.isPending && move.variables?.status === next}
                disabled={move.isPending}
                onPress={() => doMove(next)}
              />
            ))}
          </View>
          {location.trim() && !['booked', 'delivered', 'cancelled'].includes(s.status) ? (
            <Button
              kind="quiet"
              title={t('addCheckpoint')}
              busy={addEvent.isPending}
              onPress={() =>
                addEvent.mutate(
                  { kind: 'checkpoint', location: location.trim(), note: note || undefined },
                  { onSuccess: () => (setLocation(''), setNote('')), onError: fail },
                )
              }
            />
          ) : null}
        </View>
      ) : null}

      <View>
        <Text variant="label" tone="muted">
          {t('history')}
        </Text>
        {(events.data?.events ?? [])
          .slice()
          .reverse()
          .map((e, i, all) => (
            <EventRow key={e.id} event={e} last={i === all.length - 1} />
          ))}
      </View>
    </Screen>
  );
}

function Detail({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <Row last={last}>
      <Text tone="muted" style={{ width: 110 }}>
        {label}
      </Text>
      <Text style={{ flex: 1 }}>{value}</Text>
    </Row>
  );
}

function EventRow({ event: e, last }: { event: ShipmentEvent; last: boolean }) {
  const { t } = useI18n();
  const title = e.kind === 'status' && e.to_status ? t(`status_${e.to_status}`) : t(`event_${e.kind}` as 'event_note');
  const detail = [e.location, e.note].filter(Boolean).join(' · ');
  return (
    <Row last={last}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="heading">{title}</Text>
        {detail ? <Text tone="muted">{detail}</Text> : null}
      </View>
      <Text variant="caption" tone="muted">
        {dateTime(e.occurred_at)}
      </Text>
    </Row>
  );
}
