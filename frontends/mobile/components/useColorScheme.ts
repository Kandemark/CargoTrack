import { useState, useEffect } from 'react'
import { Appearance } from 'react-native'

export function useColorScheme() {
  const [scheme, setScheme] = useState(Appearance.getColorScheme() ?? 'light')

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setScheme(colorScheme ?? 'light')
    })
    return () => sub.remove()
  }, [])

  return scheme
}
