import { Pressable, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { fontFamilies } from '@/lib/fonts'

/** A search field for the navy header, styled like the sign-in fields. */
export default function HeroSearch({
  value,
  onChangeText,
  placeholder,
}: {
  value: string
  onChangeText: (v: string) => void
  placeholder: string
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: 50,
        borderRadius: 16,
        paddingHorizontal: 16,
        gap: 10,
        backgroundColor: 'rgba(255,255,255,0.10)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
      }}>
      <Ionicons name="search" size={18} color="#93B4D8" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#93B4D8"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={{ flex: 1, color: '#FFFFFF', fontFamily: fontFamilies.body.regular, fontSize: 15, paddingVertical: 0 }}
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityLabel="Clear search">
          <Ionicons name="close-circle" size={18} color="#93B4D8" />
        </Pressable>
      ) : null}
    </View>
  )
}
