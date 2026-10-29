import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ApiError, isInsufficientCredit } from '@/api/client';
import { useBookShipment } from '@/features/shipments/queries';
import { useWallet } from '@/features/wallet/queries';
import { useI18n } from '@/i18n';
import { kes } from '@/ui/format';
import { Button, Chip, Field, Notice, Screen, Text } from '@/ui/primitives';
import { space } from '@/ui/theme';

/**
 * Booking form. Dates are quick choices rather than a calendar: almost
 * every pickup is today or within a few days, and chips work one-handed.
 * The idempotency key is made once per form, so a double tap or a retry
 * on a bad connection books (and charges) once.
 */
const PICKUP_DAYS = [0, 1, 2, 3];
const TRANSIT_DAYS = [1, 2, 3, 5, 7];

function atHour(daysFromNow: number, hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d;
}

export default function BookShipment() {
  const { t } = useI18n();
  const wallet = useWallet();
  const book = useBookShipment();
  const [idempotencyKey] = useState(() => randomUUID());

  const [reference, setReference] = useState('');
  const [origin, setOrigin] = useState('');
  const [originCountry, setOriginCountry] = useState('KE');
  const [destination, setDestination] = useState('');
  const [destinationCountry, setDestinationCountry] = useState('UG');
  const [cargo, setCargo] = useState('');
  const [weight, setWeight] = useState('');
  const [pieces, setPieces] = useState('1');
  const [pickupDays, setPickupDays] = useState(1);
  const [transitDays, setTransitDays] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const price = wallet.data?.prices.find((p) => p.code === 'shipment.create')?.unit_price_cents;
  const weightKg = Number(weight.replace(',', '.'));
  const valid = origin.trim() && destination.trim() && weightKg > 0 && /^[A-Za-z]{2}$/.test(originCountry) && /^[A-Za-z]{2}$/.test(destinationCountry);

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    setError(null);
    const pickup = atHour(pickupDays, pickupDays === 0 ? Math.min(new Date().getHours() + 2, 22) : 8);
    const deliverBy = new Date(pickup.getTime() + transitDays * 24 * 3600 * 1000);
    book.mutate(
      {
        idempotencyKey,
        input: {
          reference: reference.trim() || undefined,
          origin_name: origin.trim(),
          origin_country: originCountry.toUpperCase(),
          destination_name: destination.trim(),
          destination_country: destinationCountry.toUpperCase(),
          cargo_description: cargo.trim() || undefined,
          weight_kg: weightKg,
          pieces: Number(pieces) || 1,
          pickup_at: pickup.toISOString(),
          deliver_by: deliverBy.toISOString(),
        },
      },
      {
        onSuccess: (s) => router.replace(`/shipments/${s.id}`),
        onError: (err) => {
          if (isInsufficientCredit(err)) {
            router.push({
              pathname: '/top-up',
              params: { price: String(err.details.price_cents ?? ''), balance: String(err.details.balance_cents ?? '') },
            });
            return;
          }
          setError(err instanceof ApiError ? err.message : t('couldNotLoad'));
        },
      },
    );
  };

  const required = (v: string) => (touched && !v.trim() ? t('fieldRequired') : undefined);

  return (
    <Screen>
      {price !== undefined ? <Text tone="muted">{t('bookCost', { price: kes(price, { withCents: false }) })}</Text> : null}

      <Field label={t('reference')} hint={t('referenceHint')} value={reference} onChangeText={setReference} />

      <View style={{ gap: space.s }}>
        <Text variant="label" tone="muted">{t('from')}</Text>
        <View style={{ flexDirection: 'row', gap: space.s }}>
          <View style={{ flex: 3 }}>
            <Field label={t('place')} value={origin} onChangeText={setOrigin} error={required(origin)} placeholder="Mombasa Port" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label={t('country')} value={originCountry} onChangeText={setOriginCountry} autoCapitalize="characters" maxLength={2} />
          </View>
        </View>
      </View>

      <View style={{ gap: space.s }}>
        <Text variant="label" tone="muted">{t('to')}</Text>
        <View style={{ flexDirection: 'row', gap: space.s }}>
          <View style={{ flex: 3 }}>
            <Field label={t('place')} value={destination} onChangeText={setDestination} error={required(destination)} placeholder="Kampala ICD" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label={t('country')} value={destinationCountry} onChangeText={setDestinationCountry} autoCapitalize="characters" maxLength={2} />
          </View>
        </View>
      </View>

      <Field label={t('cargo')} value={cargo} onChangeText={setCargo} placeholder="20ft container" />
      <View style={{ flexDirection: 'row', gap: space.s }}>
        <View style={{ flex: 2 }}>
          <Field
            label={t('weightKg')}
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            error={touched && !(weightKg > 0) ? t('fieldRequired') : undefined}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t('pieces')} value={pieces} onChangeText={(v) => setPieces(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" />
        </View>
      </View>

      <View style={{ gap: space.s }}>
        <Text variant="label" tone="muted">{t('pickup')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {PICKUP_DAYS.map((d) => (
            <Chip
              key={d}
              label={d === 0 ? t('today') : d === 1 ? t('tomorrow') : t('inDays', { n: d })}
              selected={pickupDays === d}
              onPress={() => setPickupDays(d)}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: space.s }}>
        <Text variant="label" tone="muted">{t('deliverBy')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {TRANSIT_DAYS.map((d) => (
            <Chip key={d} label={t('daysAfter', { n: d })} selected={transitDays === d} onPress={() => setTransitDays(d)} />
          ))}
        </View>
      </View>

      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button title={t('book')} busy={book.isPending} onPress={submit} />
    </Screen>
  );
}
