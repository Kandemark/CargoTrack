import { useState, useRef } from 'react'
import { View, Text, TouchableOpacity, Dimensions, ScrollView, StatusBar, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInRight, FadeOutLeft, FadeIn } from 'react-native-reanimated'
import * as Notifications from 'expo-notifications'
import { useOnboardingStore, useAuthStore } from '@/lib/store'
import { Button } from '@/components/ui'

const { width: SW } = Dimensions.get('window')

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

// ── Dot indicator ──────────────────────────────────────────────────────────────

function Dots({ count, active }: { count: number; active: number }) {
  return (
    <View className="flex-row gap-1.5">
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          className="h-1.5 rounded-full"
          style={{
            width: i === active ? 20 : 6,
            backgroundColor: i === active ? '#f5801e' : 'rgba(255,255,255,0.25)',
          }}
        />
      ))}
    </View>
  )
}

// ── Permission card ────────────────────────────────────────────────────────────

function PermissionCard({
  icon, title, description, onAllow, onSkip,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  title: string
  description: string
  onAllow: () => void
  onSkip: () => void
}) {
  return (
    <Animated.View entering={FadeIn.duration(300)} className="px-8">
      <View className="w-20 h-20 rounded-ct-xl bg-white/10 items-center justify-center mb-6 self-center">
        <Ionicons name={icon} size={38} color="#fff" />
      </View>
      <Text className="text-ct-2xl font-extrabold text-white text-center mb-3">{title}</Text>
      <Text className="text-ct-sm text-ct-text-brand leading-[22px] text-center mb-10">{description}</Text>
      <TouchableOpacity
        onPress={onAllow}
        className="bg-ct-orange rounded-ct-lg py-4 items-center mb-3"
        style={{ shadowColor: '#f5801e', shadowOpacity: 0.4, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 4 }}
        activeOpacity={0.85}
      >
        <Text className="text-ct-base font-extrabold text-white">Allow</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onSkip} className="items-center p-3" activeOpacity={0.7}>
        <Text className="text-ct-sm text-[#5d87b5]">Skip for now</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

// ── Screen ─────────────────────────────────────────────────────────────────────

type Phase = 'slides' | 'perm-notifications' | 'done'

export default function OnboardingScreen() {
  const [slideIdx, setSlideIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('slides')
  const scrollRef = useRef<ScrollView>(null)

  const { markOnboarded } = useOnboardingStore()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

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
    // If denied, user can enable later — continue anyway
    void status
    await finish()
  }

  const slide = SLIDES[slideIdx]

  return (
    <View className="flex-1 bg-ct-navy">
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        {phase === 'slides' && (
          <>
            {/* Skip */}
            <TouchableOpacity onPress={finish} className="self-end p-4" activeOpacity={0.7}>
              <Text className="text-ct-sm text-[#5d87b5]">Skip</Text>
            </TouchableOpacity>

            {/* Carousel */}
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              scrollEnabled={false}
              showsHorizontalScrollIndicator={false}
              className="flex-1"
            >
              {SLIDES.map((s, idx) => (
                <Animated.View
                  key={s.key}
                  entering={idx === slideIdx ? FadeInRight.duration(350) : undefined}
                  exiting={FadeOutLeft.duration(250)}
                  style={{ width: SW }}
                  className="flex-1 items-center justify-center px-8"
                >
                  {/* Icon */}
                  <View
                    className="w-[120px] h-[120px] rounded-ct-2xl items-center justify-center mb-10"
                    style={{
                      backgroundColor: s.iconBg,
                      shadowColor: s.accent,
                      shadowOpacity: 0.4,
                      shadowOffset: { width: 0, height: 8 },
                      shadowRadius: 20,
                      elevation: 8,
                    }}
                  >
                    <Ionicons name={s.icon} size={56} color="#fff" />
                  </View>

                  {/* Text */}
                  <Text className="text-ct-3xl font-extrabold text-white text-center tracking-tight mb-4 leading-[36px]">
                    {s.title}
                  </Text>
                  <Text className="text-ct-base text-ct-text-brand leading-6 text-center">
                    {s.subtitle}
                  </Text>
                </Animated.View>
              ))}
            </ScrollView>

            {/* Bottom controls */}
            <View className="px-8" style={{ paddingBottom: Platform.OS === 'android' ? 24 : 12 }}>
              <View className="flex-row items-center justify-between mb-6">
                <Dots count={SLIDES.length} active={slideIdx} />
                <TouchableOpacity
                  onPress={nextSlide}
                  className="flex-row items-center bg-ct-orange px-6 py-3.5 rounded-ct-lg"
                  style={{ shadowColor: '#f5801e', shadowOpacity: 0.35, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 4 }}
                  activeOpacity={0.85}
                >
                  <Text className="text-ct-base font-extrabold text-white mr-1.5">{slide.cta}</Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {phase === 'perm-notifications' && (
          <View className="flex-1 justify-center">
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
