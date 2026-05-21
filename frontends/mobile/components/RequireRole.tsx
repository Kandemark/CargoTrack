import { View, Text, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/lib/store'
import { useAppTheme } from '@/lib/useAppTheme'
import type { UserRole } from '@shared/api/types'

/**
 * Render-blocking role guard. Wrap any screen that should only be accessible
 * to specific roles. If the user doesn't have the required role, they see an
 * "Access Denied" screen with a button to go back.
 *
 * Backend authorization is the primary enforcement layer; this component
 * provides defense-in-depth by keeping unauthorized users out of the UI.
 */
export default function RequireRole({
  roles,
  children,
}: {
  roles: UserRole[]
  children: React.ReactNode
}) {
  const user = useAuthStore((s) => s.user)
  const { colors, font, radius, spacing } = useAppTheme()

  if (!user || !roles.includes(user.role)) {
    return (
      <View style={{
        flex: 1,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
      }}>
        <Ionicons name="shield-outline" size={64} color={colors.textFaint} />
        <Text style={{
          fontSize: font.size.xl,
          fontWeight: font.weight.extrabold,
          color: colors.text,
          marginTop: 20,
          marginBottom: 8,
        }}>
          Access Denied
        </Text>
        <Text style={{
          fontSize: font.size.sm,
          color: colors.textMuted,
          textAlign: 'center',
          marginBottom: 28,
          lineHeight: 20,
        }}>
          You don't have permission to access this section.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            backgroundColor: colors.muted,
            borderRadius: radius.md,
            paddingHorizontal: 24,
            paddingVertical: 12,
          }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.text }}>
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    )
  }

  return <>{children}</>
}
