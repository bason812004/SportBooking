import { Stack, useRouter } from "expo-router";
import { TouchableOpacity, Text, View } from "react-native";
import { LogOut, ArrowLeft } from "lucide-react-native";
import { useAuthStore } from "../../src/store/auth";
import { colors } from "../../src/theme/tokens";

export default function PartnerLayout() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: "#022c22" },
        headerTintColor: "#ffffff",
        headerTitleStyle: { fontWeight: "900" },
        headerRight: () => (
          <TouchableOpacity
            onPress={async () => {
              await logout();
              router.replace("/auth/login");
            }}
            style={{ padding: 6 }}
          >
            <LogOut size={20} color="#f87171" />
          </TouchableOpacity>
        )
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: `Đối Tác - ${user?.fullName ?? "Dashboard"}`,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.replace("/(tabs)")} style={{ marginRight: 12 }}>
              <ArrowLeft size={20} color="#ffffff" />
            </TouchableOpacity>
          )
        }}
      />
      <Stack.Screen name="courts" options={{ title: "Quản lý Sân Đối Tác" }} />
      <Stack.Screen name="bookings" options={{ title: "Quản lý Đặt Sân" }} />
      <Stack.Screen name="vouchers" options={{ title: "Quản lý Voucher" }} />
    </Stack>
  );
}
