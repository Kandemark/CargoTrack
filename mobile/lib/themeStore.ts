import { useEffect } from 'react'
import { Appearance } from 'react-native'
import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedMode = 'light' | 'dark'

const STORAGE_KEY = 'cargotrack_theme_v1'

function getSystemMode(): ResolvedMode {
  return Appearance.getColorScheme() ?? 'light'
}

interface ThemeState {
  mode: ThemeMode
  resolved: ResolvedMode
  setMode: (m: ThemeMode) => void
  _init: () => Promise<void>
}

export const useThemeStore = create<ThemeState>()((set, get) => ({
  mode: 'system',
  resolved: getSystemMode(),

  setMode: async (m: ThemeMode) => {
    const resolved = m === 'system' ? getSystemMode() : m
    await AsyncStorage.setItem(STORAGE_KEY, m)
    set({ mode: m, resolved })
  },

  _init: async () => {
    const stored = await AsyncStorage.getItem(STORAGE_KEY)
    const mode: ThemeMode =
      stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
    const resolved = mode === 'system' ? getSystemMode() : mode
    set({ mode, resolved })
  },
}))

/** Call once at app startup to load the persisted theme preference. */
export function useInitTheme() {
  const _init = useThemeStore((s) => s._init)

  useEffect(() => {
    _init()
  }, [_init])

  // Listen for system appearance changes when in 'system' mode
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      const { mode, setMode } = useThemeStore.getState()
      if (mode === 'system' && colorScheme) {
        setMode('system') // triggers resolved recalculation
      }
    })
    return () => sub.remove()
  }, [])
}
