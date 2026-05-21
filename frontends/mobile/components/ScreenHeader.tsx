import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { DrawerActions, useNavigation } from '@react-navigation/native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore, useAlertStore } from '@/lib/store'

interface ScreenHeaderProps {
  title: string
  subtitle?: string
  backButton?: boolean
}

export default function ScreenHeader({ title, subtitle, backButton }: ScreenHeaderProps) {
  const user = useAuthStore((s) => s.user)
  const unreadCount = useAlertStore((s) => s.unreadCount)
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()

  const initials = user
    ? `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase()
    : '?'

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        {/* Left: profile avatar (opens drawer) or back button */}
        {backButton ? (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={22} color="#ffffff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
            style={styles.avatarBtn}
            activeOpacity={0.8}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Center: title */}
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
        </View>

        {/* Right: notification bell */}
        <TouchableOpacity
          onPress={() => router.navigate('/notifications' as any)}
          style={styles.iconBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="notifications-outline" size={22} color="#ffffff" />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#0f2d5e',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    paddingHorizontal: 16,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 20,
    overflow: 'hidden',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 20,
    backgroundColor: '#f5801e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    marginTop: 1,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 6,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#f5801e',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#0f2d5e',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 12,
  },
})
