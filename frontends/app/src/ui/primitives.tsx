import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text as RNText,
  TextInput,
  View,
  type TextInputProps,
  type TextProps as RNTextProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { maxContentWidth, space, touch, type, usePalette, type Palette } from './theme';

type Variant = keyof typeof type;
type Tone = 'ink' | 'muted' | 'faint' | 'accent' | 'ok' | 'warn' | 'danger';

export function Text({
  variant = 'body',
  tone = 'ink',
  numeric = false,
  style,
  ...props
}: RNTextProps & { variant?: Variant; tone?: Tone; numeric?: boolean }) {
  const c = usePalette();
  return (
    <RNText
      {...props}
      style={[
        type[variant],
        { color: c[tone] },
        variant === 'label' && { textTransform: 'uppercase' },
        numeric && { fontVariant: ['tabular-nums'] },
        style,
      ]}
    />
  );
}

/** A scrolling page with safe-area padding and a readable width on desktop. */
export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const c = usePalette();
  const body = (
    <View style={{ width: '100%', maxWidth: maxContentWidth, alignSelf: 'center', padding: space.m, gap: space.l }}>
      {children}
    </View>
  );
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.paper }}>
      {scroll ? (
        <ScrollView contentContainerStyle={{ paddingBottom: space.xl }} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  busy = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'quiet';
  busy?: boolean;
  disabled?: boolean;
}) {
  const c = usePalette();
  const primary = kind === 'primary';
  const inactive = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: touch,
        paddingHorizontal: space.l,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: primary ? c.accent : 'transparent',
        opacity: inactive ? 0.5 : pressed ? 0.85 : 1,
      })}>
      {busy ? (
        <ActivityIndicator color={primary ? c.onAccent : c.accent} />
      ) : (
        <Text variant="heading" style={{ color: primary ? c.onAccent : c.accent }}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({ label, hint, error, ...props }: TextInputProps & { label: string; hint?: string; error?: string }) {
  const c = usePalette();
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <TextInput
        placeholderTextColor={c.faint}
        {...props}
        style={[
          type.body,
          {
            minHeight: touch,
            paddingHorizontal: space.m,
            borderRadius: 10,
            color: c.ink,
            backgroundColor: c.sunken,
          },
        ]}
      />
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** A row in a list, separated from the next by a hairline, not a box. */
export function Row({ children, last = false }: { children: ReactNode; last?: boolean }) {
  const c = usePalette();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.m,
        paddingVertical: space.m,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.line,
      }}>
      {children}
    </View>
  );
}

export function Notice({ tone, children }: { tone: 'ok' | 'warn' | 'danger'; children: ReactNode }) {
  const c = usePalette();
  return (
    <View style={{ borderLeftWidth: 3, borderLeftColor: c[tone], paddingLeft: space.m, paddingVertical: space.xs }}>
      {typeof children === 'string' ? <Text>{children}</Text> : children}
    </View>
  );
}

export function Loading() {
  const c = usePalette();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.paper }}>
      <ActivityIndicator color={c.accent} />
    </View>
  );
}

export type { Palette };

/** A selectable pill, for filters and quick choices. */
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const c = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minHeight: 40,
        paddingHorizontal: space.m,
        borderRadius: 20,
        justifyContent: 'center',
        backgroundColor: selected ? c.ink : c.sunken,
      }}>
      <Text variant="caption" style={{ color: selected ? c.paper : c.ink, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}
