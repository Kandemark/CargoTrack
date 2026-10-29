import { NativeTabs } from 'expo-router/native-tabs';

import { useAuth } from '@/auth/AuthProvider';
import { can, isDriverOnly } from '@/auth/permissions';
import { useI18n } from '@/i18n';
import { usePalette } from '@/ui/theme';

/**
 * Phones: the platform's own bottom tabs (Material on Android). At most
 * five, chosen by role as more screens arrive; everything else is
 * reachable from within them. The web build uses _layout.web.tsx.
 */
export default function AppTabs() {
  const { t } = useI18n();
  const c = usePalette();
  const { roles } = useAuth();
  return (
    <NativeTabs
      backgroundColor={c.paper}
      indicatorColor={c.sunken}
      tintColor={c.accent}
      labelStyle={{ color: c.muted, selected: { color: c.ink } }}>
      <NativeTabs.Trigger name="(shipments)">
        <NativeTabs.Trigger.Label>{isDriverOnly(roles) ? t('jobs') : t('shipments')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="shippingbox" md="local_shipping" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="wallet" hidden={!can(roles, 'billing.view')}>
        <NativeTabs.Trigger.Label>{t('wallet')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="creditcard" md="account_balance_wallet" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>{t('account')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
