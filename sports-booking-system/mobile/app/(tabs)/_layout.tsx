import { Tabs } from "expo-router";
import { CalendarCheck, Home, Search, TicketPercent, UserRound } from "lucide-react-native";
import { colors, radii, spacing } from "../../src/theme/tokens";

const iconSize = 22;

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "800" },
        tabBarStyle: {
          minHeight: 68,
          paddingTop: 8,
          paddingBottom: spacing.sm,
          borderTopWidth: 0,
          borderTopLeftRadius: radii.xl,
          borderTopRightRadius: radii.xl,
          backgroundColor: colors.surface,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: 0.08,
          shadowRadius: 14,
          elevation: 12
        }
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Trang chu", tabBarIcon: ({ color }) => <Home color={color} size={iconSize} /> }} />
      <Tabs.Screen name="courts" options={{ title: "Tim san", tabBarIcon: ({ color }) => <Search color={color} size={iconSize} /> }} />
      <Tabs.Screen name="bookings" options={{ title: "Dat cua toi", tabBarIcon: ({ color }) => <CalendarCheck color={color} size={iconSize} /> }} />
      <Tabs.Screen name="vouchers" options={{ title: "Voucher", tabBarIcon: ({ color }) => <TicketPercent color={color} size={iconSize} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Tai khoan", tabBarIcon: ({ color }) => <UserRound color={color} size={iconSize} /> }} />
    </Tabs>
  );
}

