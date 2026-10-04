import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../src/store/auth";

export default function Index() {
  const router = useRouter();
  const bootstrapped = useAuthStore((s) => s.bootstrapped);

  useEffect(() => {
    if (!bootstrapped) return;
    router.replace("/(tabs)");
  }, [bootstrapped, router]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#022c22" }}>
      <ActivityIndicator size="large" color="#10b981" />
      <Text style={{ marginTop: 16, fontSize: 18, fontWeight: "800", color: "#ffffff" }}>
        SportBooking
      </Text>
      <Text style={{ marginTop: 4, fontSize: 13, color: "#a7f3d0" }}>
        Đang khởi tạo hệ thống...
      </Text>
    </View>
  );
}
