import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

function TabIcon({
  name,
  color,
  focused,
}: {
  name: React.ComponentProps<typeof Ionicons>['name']
  color: string
  focused: boolean
}) {
  return <Ionicons name={focused ? name : (`${name}-outline` as any)} size={24} color={color} />
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0f2d5e',
          borderTopColor: '#1e3f7a',
          borderTopWidth: 1,
          paddingBottom: 4,
          height: 60,
        },
        tabBarActiveTintColor: '#f5801e',
        tabBarInactiveTintColor: '#93b4d8',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="speedometer" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="shipments"
        options={{
          title: 'Shipments',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="cube" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="notifications" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  )
}
