import { useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { attemptBiometricUnlock } from '@/lib/security'
import { checkBiometricCapabilities, type BiometricCapabilities } from '@/lib/biometrics'
import { useAppTheme } from '@/lib/useAppTheme'

interface LockScreenProps {
  onLogout: () => void
}

export default function LockScreen({ onLogout }: LockScreenProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bioCap] = useState<Promise<BiometricCapabilities>>(() => checkBiometricCapabilities())
  const { colors, brand } = useAppTheme()

  const handleUnlock = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const cap = await bioCap
      if (!cap.isAvailable || !cap.isEnrolled) {
        setError(`Biometric authentication is not available. Please sign in again.`)
        return
      }
      const ok = await attemptBiometricUnlock()
      if (!ok) {
        setError('Authentication failed. Try again.')
      }
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }, [bioCap])

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: brand.primary + '15' }]}>
          <Ionicons name="lock-closed" size={36} color={brand.primary} />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>App Locked</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Authenticate to continue using CargoTrack
        </Text>

        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : null}

        <TouchableOpacity
          onPress={handleUnlock}
          disabled={loading}
          activeOpacity={0.8}
          style={[styles.unlockBtn, { backgroundColor: brand.primary }]}
        >
          <Ionicons name="finger-print-outline" size={22} color="#fff" />
          <Text style={styles.unlockText}>
            {loading ? 'Verifying...' : 'Unlock'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
          <Text style={[styles.logoutText, { color: colors.textFaint }]}>
            Sign Out
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
    width: '100%',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 20,
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 20,
  },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 14,
    width: '100%',
  },
  unlockText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  logoutBtn: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '600',
  },
})
