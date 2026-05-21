import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ThemeState {
  dark: boolean
  toggle: () => void
  setDark: (dark: boolean) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      dark: false,

      toggle: () => {
        const next = !get().dark
        document.documentElement.classList.toggle('dark', next)
        set({ dark: next })
      },

      setDark: (dark: boolean) => {
        document.documentElement.classList.toggle('dark', dark)
        set({ dark })
      },
    }),
    {
      name: 'ct-theme',
      onRehydrateStorage: () => (state) => {
        // Apply persisted theme on page load before first render
        if (state?.dark) {
          document.documentElement.classList.add('dark')
        }
      },
    },
  ),
)
