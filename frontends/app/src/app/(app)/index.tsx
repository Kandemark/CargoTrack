import { router } from 'expo-router';
import { View } from 'react-native';

import { useLedger, useWallet, type LedgerEntry } from '@/features/wallet/queries';
import { useI18n } from '@/i18n';
import { Button, Loading, Notice, Row, Screen, Text } from '@/ui/primitives';
import { dateTime, kes } from '@/ui/format';
import { space } from '@/ui/theme';

/** Balance first and large, then what things cost, then the history. */
export default function WalletScreen() {
  const { t } = useI18n();
  const wallet = useWallet();
  const ledger = useLedger();

  if (wallet.isPending) return <Loading />;
  if (wallet.isError) {
    return (
      <Screen>
        <Notice tone="danger">{t('couldNotLoad')}</Notice>
        <Button kind="quiet" title={t('retry')} onPress={() => void wallet.refetch()} />
      </Screen>
    );
  }

  const w = wallet.data;
  const entries = ledger.data?.pages.flatMap((p) => p.entries) ?? [];

  return (
    <Screen>
      <View style={{ gap: space.s }}>
        <Text variant="label" tone="muted">
          {t('balance')}
        </Text>
        <Text variant="display" numeric>
          {kes(w.balance_cents)}
        </Text>
      </View>

      {w.low_balance ? <Notice tone="warn">{t('lowBalance')}</Notice> : null}

      <Button title={t('topUp')} onPress={() => router.push('/top-up')} />

      <View>
        <Text variant="label" tone="muted">
          {t('prices')}
        </Text>
        {w.prices.map((m, i) => (
          <Row key={m.code} last={i === w.prices.length - 1}>
            <Text style={{ flex: 1 }}>{m.name}</Text>
            <Text numeric tone="muted">
              {kes(m.unit_price_cents, { withCents: false })} {t('each')}
            </Text>
          </Row>
        ))}
      </View>

      <View>
        <Text variant="label" tone="muted">
          {t('history')}
        </Text>
        {ledger.isError ? (
          <Notice tone="danger">{t('couldNotLoad')}</Notice>
        ) : entries.length === 0 && !ledger.isPending ? (
          <Text tone="muted" style={{ paddingVertical: space.m }}>
            {t('noHistory')}
          </Text>
        ) : (
          entries.map((e, i) => <Entry key={e.id} entry={e} last={i === entries.length - 1} />)
        )}
        {ledger.hasNextPage ? (
          <Button
            kind="quiet"
            title={t('more')}
            busy={ledger.isFetchingNextPage}
            onPress={() => void ledger.fetchNextPage()}
          />
        ) : null}
      </View>
    </Screen>
  );
}

function Entry({ entry, last }: { entry: LedgerEntry; last: boolean }) {
  const { t } = useI18n();
  const credit = entry.amount_cents > 0;
  return (
    <Row last={last}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text>{entry.description || t(`kind_${entry.kind}`)}</Text>
        <Text variant="caption" tone="muted">
          {dateTime(entry.created_at)}
        </Text>
      </View>
      <Text numeric tone={credit ? 'ok' : 'ink'}>
        {credit ? '+' : ''}
        {kes(entry.amount_cents)}
      </Text>
    </Row>
  );
}
