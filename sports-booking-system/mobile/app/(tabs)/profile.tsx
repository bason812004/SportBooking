import { useRouter } from "expo-router";
import {
  Bell,
  CalendarCheck,
  ChevronRight,
  FileText,
  Gift,
  HelpCircle,
  KeyRound,
  LogOut,
  MessageSquare,
  ShieldCheck,
  TicketPercent,
  UserPen,
  UsersRound
} from "lucide-react-native";
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
      <Screen title="Tài Khoản" subtitle="Đăng nhập để quản lý hồ sơ và lịch đặt sân.">
        <Card style={{ gap: spacing.md }}>
          <Text style={styles.title}>Bạn đang ở chế độ khách</Text>
          <Text style={styles.meta}>
            Đăng nhập tài khoản để đặt sân, nhận ưu đãi voucher và tham gia cộng đồng thể thao.
          </Text>
          <Button onPress={() => router.push("/auth/login")}>Đăng nhập ngay</Button>
          <Button variant="secondary" onPress={() => router.push("/auth/register")}>Tạo tài khoản mới</Button>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title="Tài Khoản" subtitle="Hồ sơ cá nhân và quản lý hoạt động thể thao.">
      {/* Profile Header Card */}
      <Card style={{ gap: spacing.xs }}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.fullName?.slice(0, 1)?.toUpperCase() || "U"}</Text>
        </View>
        <Text style={styles.title}>{user.fullName}</Text>
        <Text style={styles.meta}>{user.email}</Text>
        {user.phone ? <Text style={styles.meta}>SĐT: {user.phone}</Text> : null}
      </Card>

      {/* Activity Shortcuts */}
      <Card>
        <Text style={styles.sectionHeading}>Hoạt động của tôi</Text>
        <MenuItem
          icon={<CalendarCheck size={20} color={colors.primary} />}
          label="Lịch sử đặt sân"
          onPress={() => router.push("/(tabs)/bookings")}
        />
        <MenuItem
          icon={<TicketPercent size={20} color={colors.primary} />}
          label="Kho voucher của tôi"
          onPress={() => router.push("/(tabs)/vouchers")}
        />
        <MenuItem
          icon={<MessageSquare size={20} color={colors.primary} />}
          label="Nhóm ghép đội & Chat"
          onPress={() => router.push("/profile/joined-groups")}
        />
        <MenuItem
          icon={<UsersRound size={20} color={colors.primary} />}
          label="Đăng bài tìm bạn"
          onPress={() => router.push("/teammates/create")}
        />
      </Card>

      {/* Account Settings */}
      <Card>
        <Text style={styles.sectionHeading}>Cài đặt tài khoản</Text>
        <MenuItem
          icon={<UserPen size={20} color={colors.primary} />}
          label="Chỉnh sửa thông tin cá nhân"
          onPress={() => router.push("/profile/edit")}
        />
        <MenuItem
          icon={<Bell size={20} color={colors.primary} />}
          label="Thông báo hệ thống"
          onPress={() => router.push("/notifications")}
        />
        <MenuItem
          icon={<KeyRound size={20} color={colors.primary} />}
          label="Đổi mật khẩu"
          onPress={() => router.push("/profile/change-password")}
        />
        <MenuItem
          icon={<LogOut size={20} color={colors.danger} />}
          label="Đăng xuất"
          danger
          onPress={() =>
            Alert.alert("Đăng xuất", "Bạn có chắc chắn muốn đăng xuất tài khoản?", [
              { text: "Hủy", style: "cancel" },
              { text: "Đăng xuất", style: "destructive", onPress: () => void logout() }
            ])
          }
        />
      </Card>
    </Screen>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  danger
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
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
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs
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
  sectionHeading: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs
  },
  menuItem: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2
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
