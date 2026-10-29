import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';

import { api, call } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { useI18n, type Language } from '@/i18n';
import { Button, Loading, Notice, Row, Screen, Text } from '@/ui/primitives';
import { space } from '@/ui/theme';

export default function AccountScreen() {
  const { t, language, setLanguage } = useI18n();
  const { signOut } = useAuth();
  const me = useQuery({ queryKey: ['me'], queryFn: () => call(api.GET('/v1/me')) });

  if (me.isPending) return <Loading />;

  return (
    <Screen>
      <Text variant="title">{t('account')}</Text>

      {me.isError ? (
        <Notice tone="danger">{t('couldNotLoad')}</Notice>
      ) : (
        <View>
          <Row>
            <Text tone="muted" style={{ width: 120 }}>
              {t('organisation')}
            </Text>
            <Text style={{ flex: 1 }}>{me.data.organization.name}</Text>
          </Row>
          <Row last>
            <Text tone="muted" style={{ width: 120 }}>
              {t('roles')}
            </Text>
            <Text style={{ flex: 1 }}>{me.data.roles.join(', ') || '—'}</Text>
          </Row>
        </View>
      )}

      <View style={{ gap: space.s }}>
        <Text variant="label" tone="muted">
          {t('language')}
        </Text>
        <View style={{ flexDirection: 'row', gap: space.s }}>
          {(['en', 'sw'] as Language[]).map((l) => (
            <View key={l} style={{ flex: 1 }}>
              <Button
                kind={language === l ? 'primary' : 'quiet'}
                title={l === 'en' ? t('english') : t('swahili')}
                onPress={() => setLanguage(l)}
              />
            </View>
          ))}
        </View>
      </View>

      <Button kind="quiet" title={t('signOut')} onPress={() => void signOut()} />
    </Screen>
  );
}
