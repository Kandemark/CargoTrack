/**
 * @file mobile/app/onboarding.tsx
 * @description First-run onboarding carousel — shown once, gated by AsyncStorage.
 *
 * Screens:
 *   1. "Know where every shipment is — in real time"
 *   2. "Your whole fleet, one view"
 *   3. "Proof of delivery, instantly"
 *
 * After completion, calls markOnboarded() and navigates to auth flow.
 * Permissions (location, notifications) are requested in sequence after
 * the user explicitly taps "Allow" — never cold-presented.
 */
import { useState, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInRight, FadeOutLeft, FadeIn } from 'react-native-reanimated'
import * as Notifications from 'expo-notifications'
import { useOnboardingStore, useAuthStore } from '@/lib/store'

const { width: SW } = Dimensions.get('window')

// ─── Slide data ───────────────────────────────────────────────────────────────

const SLIDES = [
  {
    key: 'track',
    icon: 'navigate' as const,
    iconBg: '#1a3a6b',
    accent: '#f5801e',
    title: 'Know where every\nshipment is',
    subtitle: 'Real-time tracking across the entire\nEast Africa corridor — Mombasa to Kigali,\nNairobi to Kampala, at a glance.',
    cta: 'Next',
  },
  {
    key: 'fleet',
    icon: 'cube' as const,
    iconBg: '#f5801e',
    accent: '#0f2d5e',
    title: 'Your whole fleet,\none view',
    subtitle: 'AI-powered delay risk scoring, carrier\nperformance analytics, and instant alerts\nwhen something needs your attention.',
    cta: 'Next',
  },
  {
    key: 'delivery',
    icon: 'checkmark-circle' as const,
    iconBg: '#10b981',
    accent: '#10b981',
    title: 'Proof of delivery,\ninstantly',
    subtitle: 'Log tracking events and delivery\nconfirmations in the field. Every\nhandoff, recorded and auditable.',
    cta: 'Get started',
  },
] as const

// ─── Permission request screen ────────────────────────────────────────────────

function PermissionCard({
  icon,
  title,
  description,
  onAllow,
  onSkip,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  title: string
  description: string
  onAllow: () => void
  onSkip: () => void
}) {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={{ padding: 32 }}>
      <View style={{
        width: 80, height: 80, borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 24, alignSelf: 'center',
      }}>
        <Ionicons name={icon} size={38} color="#fff" />
      </View>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 12 }}>
        {title}
      </Text>
      <Text style={{ color: '#93b4d8', fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 40 }}>
        {description}
      </Text>
      <TouchableOpacity
        onPress={onAllow}
        style={{
          backgroundColor: '#f5801e', borderRadius: 16, paddingVertical: 16,
          alignItems: 'center', marginBottom: 12,
          shadowColor: '#f5801e', shadowOpacity: 0.4,
          shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 4,
        }}
        activeOpacity={0.85}
      >
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Allow</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onSkip} style={{ alignItems: 'center', padding: 12 }} activeOpacity={0.7}>
        <Text style={{ color: '#5d87b5', fontSize: 14 }}>Skip for now</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

// ─── Dot indicator ────────────────────────────────────────────────────────────

function Dots({ count, active }: { count: number; active: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            width: i === active ? 20 : 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i === active ? '#f5801e' : 'rgba(255,255,255,0.25)',
          }}
        />
      ))}
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

type Phase = 'slides' | 'perm-notifications' | 'done'

export default function OnboardingScreen() {
  const [slideIdx, setSlideIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('slides')
  const scrollRef = useRef<ScrollView>(null)

  const { markOnboarded } = useOnboardingStore()
  const isAuthenticated   = useAuthStore((s) => s.isAuthenticated)

  async function finish() {
    await markOnboarded()
    router.replace(isAuthenticated ? '/(tabs)' : '/(auth)/login')
  }

  function nextSlide() {
    if (slideIdx < SLIDES.length - 1) {
      const next = slideIdx + 1
      setSlideIdx(next)
      scrollRef.current?.scrollTo({ x: next * SW, animated: true })
    } else {
      setPhase('perm-notifications')
    }
  }

  async function requestNotifications() {
    const { status } = await Notifications.requestPermissionsAsync()
    if (status !== 'granted') {
      // OS dialog declined — that's okay, user can enable later
    }
    await finish()
  }

  const slide = SLIDES[slideIdx]

  return (
    <View style={{ flex: 1, backgroundColor: '#0f2d5e' }}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>

        {phase === 'slides' && (
          <>
            {/* Skip */}
            <TouchableOpacity
              onPress={finish}
              style={{ alignSelf: 'flex-end', padding: 16 }}
              activeOpacity={0.7}
            >
              <Text style={{ color: '#5d87b5', fontSize: 14 }}>Skip</Text>
            </TouchableOpacity>

            {/* Carousel */}
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              scrollEnabled={false}
              showsHorizontalScrollIndicator={false}
              style={{ flex: 1 }}
            >
              {SLIDES.map((s, idx) => (
                <Animated.View
                  key={s.key}
                  entering={idx === slideIdx ? FadeInRight.duration(350) : undefined}
                  exiting={FadeOutLeft.duration(250)}
                  style={{ width: SW, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}
                >
                  {/* Icon */}
                  <View style={{
                    width: 120, height: 120, borderRadius: 36,
                    backgroundColor: s.iconBg,
                    alignItems: 'center', justifyContent: 'center',
                    marginBottom: 40,
                    shadowColor: s.accent,
                    shadowOpacity: 0.4,
                    shadowOffset: { width: 0, height: 8 },
                    shadowRadius: 20,
                    elevation: 8,
                  }}>
                    <Ionicons name={s.icon} size={56} color="#fff" />
                  </View>

                  {/* Text */}
                  <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5, marginBottom: 16, lineHeight: 36 }}>
                    {s.title}
                  </Text>
                  <Text style={{ color: '#93b4d8', fontSize: 15, lineHeight: 24, textAlign: 'center' }}>
                    {s.subtitle}
                  </Text>
                </Animated.View>
              ))}
            </ScrollView>

            {/* Bottom controls */}
            <View style={{ paddingHorizontal: 32, paddingBottom: Platform.OS === 'android' ? 24 : 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <Dots count={SLIDES.length} active={slideIdx} />
                <TouchableOpacity
                  onPress={nextSlide}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: '#f5801e',
                    paddingHorizontal: 24, paddingVertical: 14,
                    borderRadius: 16,
                    shadowColor: '#f5801e', shadowOpacity: 0.35,
                    shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 4,
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800', marginRight: 6 }}>
                    {slide.cta}
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {phase === 'perm-notifications' && (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <PermissionCard
              icon="notifications"
              title="Stay ahead of delays"
              description="CargoTrack sends instant alerts when a shipment is delayed, held at customs, or delivered. You can change this any time in Settings."
              onAllow={requestNotifications}
              onSkip={finish}
            />
          </View>
        )}
      </SafeAreaView>
    </View>
  )
}
