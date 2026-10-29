import type { ReactNode } from 'react'
import { RefreshControl, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAppTheme } from '@/lib/useAppTheme'
import Txt from './Txt'

/**
 * The sign-in screen's layout, for every main screen: a navy header with
 * the faint rings and the short orange bar, and a white sheet rising over
 * it with rounded top corners. `hero` goes under the title (key numbers);
 * `trailing` sits beside it (an avatar or one action).
 */
export default function ScreenFrame({
  eyebrow,
  title,
  subtitle,
  trailing,
  hero,
  children,
  refreshing,
  onRefresh,
  onEndReached,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  trailing?: ReactNode
  hero?: ReactNode
  children: ReactNode
  refreshing?: boolean
  onRefresh?: () => void
  /** Called when the user scrolls near the bottom, for loading more rows. */
  onEndReached?: () => void
}) {
  const { colors, brand, radius } = useAppTheme()
  return (
    <View style={{ flex: 1, backgroundColor: brand.primary }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={200}
          onScroll={
            onEndReached
              ? ({ nativeEvent: { layoutMeasurement, contentOffset, contentSize } }) => {
                  if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 400) onEndReached()
                }
              : undefined
          }
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" colors={[brand.accent]} />
            ) : undefined
          }>
          <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 44, overflow: 'hidden' }}>
            <Ring size={280} top={-90} right={-90} opacity={0.06} />
            <Ring size={160} top={30} right={40} opacity={0.04} />

            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                {eyebrow ? <Txt variant="caption" tone="brand">{eyebrow}</Txt> : null}
                <View style={{ width: 36, height: 3, borderRadius: 2, backgroundColor: brand.accent, marginTop: eyebrow ? 12 : 4, marginBottom: 14 }} />
                <Txt variant="display" tone="inverse">{title}</Txt>
                {subtitle ? (
                  <Txt variant="body" tone="brand" style={{ marginTop: 4 }}>
                    {subtitle}
                  </Txt>
                ) : null}
              </View>
              {trailing}
            </View>
            {hero ? <View style={{ marginTop: 24 }}>{hero}</View> : null}
          </View>

          <View
            style={{
              flex: 1,
              backgroundColor: colors.card,
              borderTopLeftRadius: radius['2xl'],
              borderTopRightRadius: radius['2xl'],
              marginTop: -22,
              paddingHorizontal: 20,
              paddingTop: 28,
              paddingBottom: 120,
              gap: 32,
            }}>
            {children}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

function Ring({ size, top, right, opacity }: { size: number; top: number; right: number; opacity: number }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 32,
        borderColor: `rgba(255,255,255,${opacity})`,
        top,
        right,
      }}
    />
  )
}

/** Key numbers in the navy header, white on navy, separated by space only. */
export function HeroStats({ items }: { items: { label: string; value: string; tone?: 'danger' | 'warning' }[] }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      {items.map((item) => (
        <View key={item.label} style={{ flex: 1 }}>
          <Txt variant="number" tone="inverse" style={item.tone === 'danger' ? { color: '#FCA5A5' } : item.tone === 'warning' ? { color: '#FDBA74' } : undefined}>
            {item.value}
          </Txt>
          <Txt variant="caption" tone="brand" style={{ marginTop: 2 }}>
            {item.label}
          </Txt>
        </View>
      ))}
    </View>
  )
}
