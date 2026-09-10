import { Tabs } from "expo-router";
import { CalendarCheck, Home, Search, UsersRound, UserRound } from "lucide-react-native";
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
          minHeight: 66,
          paddingTop: 8,
          paddingBottom: spacing.sm,
          borderTopWidth: 1,
          borderTopColor: colors.line,
          backgroundColor: colors.surface,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 10,
          elevation: 8
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Trang chủ",
          tabBarIcon: ({ color }) => <Home color={color} size={iconSize} />
        }}
      />
      <Tabs.Screen
        name="courts"
        options={{
          title: "Tìm sân",
          tabBarIcon: ({ color }) => <Search color={color} size={iconSize} />
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Đơn đặt",
          tabBarIcon: ({ color }) => <CalendarCheck color={color} size={iconSize} />
        }}
      />
      <Tabs.Screen
        name="teammates"
        options={{
          title: "Ghép đội",
          tabBarIcon: ({ color }) => <UsersRound color={color} size={iconSize} />
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Tài khoản",
          tabBarIcon: ({ color }) => <UserRound color={color} size={iconSize} />
        }}
      />
      {/* Hide Vouchers tab from bottom bar but keep route accessible */}
      <Tabs.Screen
        name="vouchers"
        options={{
          href: null
        }}
      />
    </Tabs>
  );
}
