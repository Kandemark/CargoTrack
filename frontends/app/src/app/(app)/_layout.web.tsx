import { Tabs, TabList, TabSlot, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import type { ComponentRef, Ref } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { useI18n } from '@/i18n';
import { Text } from '@/ui/primitives';
import { space, touch, usePalette } from '@/ui/theme';

/**
 * Web: a sidebar on wide screens, a bottom bar on narrow ones. Same
 * destinations as the phone tabs; only the layout differs.
 */
const WIDE = 900;

export default function WebShell() {
  const { t } = useI18n();
  const c = usePalette();
  const wide = useWindowDimensions().width >= WIDE;

  return (
    <Tabs style={{ flex: 1, flexDirection: wide ? 'row-reverse' : 'column', backgroundColor: c.paper }}>
      <TabSlot style={{ flex: 1 }} />
      <TabList
        style={
          wide
            ? { flexDirection: 'column', width: 240, padding: space.l, gap: space.xs, backgroundColor: c.sunken }
            : { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: c.line }
        }>
        {wide ? (
          <View style={{ paddingBottom: space.l }}>
            <Text variant="title">{t('appName')}</Text>
          </View>
        ) : null}
        <TabTrigger name="index" href="/" asChild>
          <NavItem wide={wide}>{t('wallet')}</NavItem>
        </TabTrigger>
        <TabTrigger name="account" href="/account" asChild>
          <NavItem wide={wide}>{t('account')}</NavItem>
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}

function NavItem({
  children,
  isFocused,
  wide,
  ref,
  ...props
}: TabTriggerSlotProps & { wide: boolean; ref?: Ref<ComponentRef<typeof Pressable>> }) {
  const c = usePalette();
  return (
    <Pressable
      ref={ref}
      {...props}
      style={{
        minHeight: touch,
        justifyContent: 'center',
        paddingHorizontal: space.m,
        borderRadius: 8,
        backgroundColor: isFocused && wide ? c.paper : 'transparent',
        flex: wide ? undefined : 1,
        alignItems: wide ? 'flex-start' : 'center',
      }}>
      <Text variant="heading" tone={isFocused ? 'ink' : 'muted'}>
        {children}
      </Text>
    </Pressable>
  );
}
