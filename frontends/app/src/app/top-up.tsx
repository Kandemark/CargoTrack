import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ApiError } from '@/api/client';
import { checkTopUp, useRefreshWallet, useStartTopUp, type TopUp } from '@/features/wallet/queries';
import { useI18n } from '@/i18n';
import { Button, Field, Notice, Screen, Text } from '@/ui/primitives';
import { kes } from '@/ui/format';
import { space, usePalette } from '@/ui/theme';

/**
 * M-Pesa top-up. Opened from the wallet, or after an action was refused
 * for lack of credit, in which case `price` and `balance` (cents) say why.
 *
 * After the STK prompt is sent the screen polls the core, which asks
 * Safaricom and rate-limits itself, until the payment succeeds, fails, or
 * two minutes pass (M-Pesa prompts expire well before that).
 */
const MIN_KES = 100;
const POLL_MS = 5000;
const GIVE_UP_MS = 120_000;

type Phase = { kind: 'form' } | { kind: 'waiting'; topup: TopUp } | { kind: 'done'; topup: TopUp };

export default function TopUpScreen() {
  const { t } = useI18n();
  const c = usePalette();
  const params = useLocalSearchParams<{ price?: string; balance?: string }>();
  const start = useStartTopUp();
  const refreshWallet = useRefreshWallet();

  const [amount, setAmount] = useState(params.price ? String(Math.ceil(Number(params.price) / 100)) : '');
  const [phone, setPhone] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'form' });
  const [error, setError] = useState<string | null>(null);
  const started = useRef(0);

  const amountKes = Number(amount);
  const amountValid = Number.isInteger(amountKes) && amountKes >= MIN_KES;

  useEffect(() => {
    if (phase.kind !== 'waiting') return;
    const timer = setInterval(async () => {
      try {
        const latest = await checkTopUp(phase.topup.id);
        if (latest.status !== 'pending' || Date.now() - started.current > GIVE_UP_MS) {
          setPhase({ kind: 'done', topup: latest });
          if (latest.status === 'succeeded') void refreshWallet();
        }
      } catch {
        // A missed poll is fine; the next one tries again.
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [phase, refreshWallet]);

  const submit = () => {
    setError(null);
    start.mutate(
      { amount_cents: amountKes * 100, phone },
      {
        onSuccess: (res) => {
          started.current = Date.now();
          setPhase({ kind: 'waiting', topup: res.topup });
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : t('couldNotLoad')),
      },
    );
  };

  return (
    <Screen>
      <Text variant="title">{t('topUpTitle')}</Text>

      {params.price ? (
        <Notice tone="warn">
          {t('topUpNeeded', { price: kes(Number(params.price)), balance: kes(Number(params.balance ?? 0)) })}
        </Notice>
      ) : null}

      {phase.kind === 'form' ? (
        <View style={{ gap: space.m }}>
          <Field
            label={t('amount')}
            hint={t('amountHint', { min: MIN_KES })}
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            inputMode="numeric"
          />
          <Field
            label={t('phone')}
            hint={t('phoneHint')}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            inputMode="tel"
            autoComplete="tel"
          />
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <Button
            title={t('sendPrompt')}
            busy={start.isPending}
            disabled={!amountValid || phone.trim().length < 9}
            onPress={submit}
          />
        </View>
      ) : null}

      {phase.kind === 'waiting' ? (
        <View style={{ gap: space.m, alignItems: 'flex-start' }}>
          <Text variant="heading">{t('checkPhone')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
            <ActivityIndicator color={c.accent} />
            <Text tone="muted">{t('waiting')}</Text>
          </View>
          <Text variant="caption" tone="faint">
            {phase.topup.reference_code}
          </Text>
        </View>
      ) : null}

      {phase.kind === 'done' ? (
        <View style={{ gap: space.m }}>
          {phase.topup.status === 'succeeded' ? (
            <Notice tone="ok">{t('topUpSucceeded', { amount: kes(phase.topup.amount_cents) })}</Notice>
          ) : (
            <Notice tone="danger">
              {t('topUpFailed', { reason: phase.topup.failure_reason || phase.topup.status })}
            </Notice>
          )}
          {phase.topup.status === 'succeeded' ? (
            <Button title={t('done')} onPress={() => router.back()} />
          ) : (
            <Button title={t('tryAgain')} onPress={() => setPhase({ kind: 'form' })} />
          )}
        </View>
      ) : null}
    </Screen>
  );
}
