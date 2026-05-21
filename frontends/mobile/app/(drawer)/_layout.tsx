import { View } from 'react-native'
import { Drawer } from 'expo-router/drawer'
import { useAppTheme } from '@/lib/useAppTheme'
import DrawerContent from '@/components/DrawerContent'

export default function DrawerLayout() {
  const { colors } = useAppTheme()

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Drawer
        drawerContent={(props) => <DrawerContent drawerNav={props.navigation} />}
        screenOptions={{
          headerShown: false,
          drawerType: 'front',
          drawerStyle: {
            width: 300,
            backgroundColor: colors.background,
          },
          swipeEdgeWidth: 40,
          overlayColor: 'rgba(0,0,0,0.45)',
        }}
      >
        <Drawer.Screen name="(tabs)" />
        <Drawer.Screen name="analytics" />
        <Drawer.Screen name="audit" />
        <Drawer.Screen name="carbon" />
        <Drawer.Screen name="carriers" />
        <Drawer.Screen name="cold-chain" />
        <Drawer.Screen name="compliance" />
        <Drawer.Screen name="eta" />
        <Drawer.Screen name="integrations" />
        <Drawer.Screen name="job-board" />
        <Drawer.Screen name="live-map" />
        <Drawer.Screen name="messages" />
        <Drawer.Screen name="notifications" />
        <Drawer.Screen name="performance" />
        <Drawer.Screen name="pod" />
        <Drawer.Screen name="predictions" />
        <Drawer.Screen name="rates" />
        <Drawer.Screen name="settings" />
        <Drawer.Screen name="sla" />
        <Drawer.Screen name="team" />
        <Drawer.Screen name="documents" />
        <Drawer.Screen name="payments" />
        <Drawer.Screen name="account" />
        <Drawer.Screen name="shipment/[id]" />
        <Drawer.Screen name="shipment/log-event" />
        <Drawer.Screen name="customs/documents" />
        <Drawer.Screen name="customs/queue" />
        <Drawer.Screen name="dispatch/queue" />
        <Drawer.Screen name="dispatch/routes" />
        <Drawer.Screen name="finance/reports" />
        <Drawer.Screen name="finance/revenue" />
        <Drawer.Screen name="fleet/analytics" />
        <Drawer.Screen name="fleet/drivers" />
        <Drawer.Screen name="fleet/trucks" />
        <Drawer.Screen name="ops/dashboard" />
        <Drawer.Screen name="port/containers" />
        <Drawer.Screen name="port/manifest" />
        <Drawer.Screen name="port/vessels" />
        <Drawer.Screen name="warehouse/inbound" />
        <Drawer.Screen name="warehouse/inventory" />
        <Drawer.Screen name="warehouse/outbound" />
      </Drawer>
    </View>
  )
}
