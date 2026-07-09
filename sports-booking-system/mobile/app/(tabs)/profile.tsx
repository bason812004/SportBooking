import { useRouter } from "expo-router";
import { Bell, ChevronRight, KeyRound, LogOut, TicketPercent, UserPen } from "lucide-react-native";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuthStore } from "../../src/store/auth";
import { Button } from "../../src/components/Buttons";
import { Card, Screen } from "../../src/components/Screen";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  if (!user) {
    return (
      <Screen title="Tai khoan" subtitle="Dang nhap de quan ly ho so va lich dat san.">
        <Card>
          <Text style={styles.title}>Ban dang o che do khach</Text>
          <Text style={styles.meta}>Ban van co the xem san, voucher, blog va giai dau. Dang nhap khi can dat san hoac nhan voucher.</Text>
          <Button onPress={() => router.push("/auth/login")}>Dang nhap</Button>
          <Button variant="secondary" onPress={() => router.push("/auth/register")}>Tao tai khoan</Button>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title="Tai khoan" subtitle="Ho so khach hang va cac thiet lap ca nhan.">
      <Card>
        <View style={styles.avatar}><Text style={styles.avatarText}>{user.fullName.slice(0, 1).toUpperCase()}</Text></View>
        <Text style={styles.title}>{user.fullName}</Text>
        <Text style={styles.meta}>{user.email}</Text>
        {user.phone ? <Text style={styles.meta}>{user.phone}</Text> : null}
      </Card>
      <Card>
        <MenuItem icon={<UserPen size={20} color={colors.primary} />} label="Chinh sua ho so" onPress={() => router.push("/profile/edit")} />
        <MenuItem icon={<TicketPercent size={20} color={colors.primary} />} label="Voucher cua toi" onPress={() => router.push("/(tabs)/vouchers")} />
        <MenuItem icon={<Bell size={20} color={colors.primary} />} label="Thong bao" onPress={() => router.push("/notifications")} />
        <MenuItem icon={<KeyRound size={20} color={colors.primary} />} label="Doi mat khau" onPress={() => router.push("/profile/change-password")} />
        <MenuItem
          icon={<LogOut size={20} color={colors.danger} />}
          label="Dang xuat"
          danger
          onPress={() => Alert.alert("Dang xuat", "Ban co chac muon dang xuat?", [
            { text: "Huy", style: "cancel" },
            { text: "Dang xuat", style: "destructive", onPress: () => void logout() }
          ])}
        />
      </Card>
    </Screen>
  );
}

function MenuItem({ icon, label, onPress, danger }: { icon: React.ReactNode; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={styles.menuItem}>
      <View style={styles.menuLeft}>
        {icon}
        <Text style={[styles.menuText, danger && { color: colors.danger }]}>{label}</Text>
      </View>
      <ChevronRight size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    color: colors.surface,
    fontSize: typography.h1,
    fontWeight: "900"
  },
  title: {
    color: colors.ink,
    fontSize: typography.h2,
    fontWeight: "900"
  },
  meta: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 19
  },
  menuItem: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  menuText: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: "800"
  }
});

