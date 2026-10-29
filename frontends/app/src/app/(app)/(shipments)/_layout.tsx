import { Stack } from 'expo-router';

import { useI18n } from '@/i18n';
import { usePalette } from '@/ui/theme';

export default function ShipmentsStack() {
  const { t } = useI18n();
  const c = usePalette();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.paper },
        headerTintColor: c.ink,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: c.paper },
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="shipments/[id]" options={{ title: '' }} />
      <Stack.Screen name="shipments/new" options={{ title: t('bookTitle') }} />
    </Stack>
  );
}
