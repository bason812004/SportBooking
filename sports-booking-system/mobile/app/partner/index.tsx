import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { partnerApi } from "../../src/api/partner";
import { Card, Screen } from "../../src/components/Screen";
import { LoadingState, ErrorState } from "../../src/components/StateViews";
import { colors, typography, spacing } from "../../src/theme/tokens";
import { formatCurrency } from "../../src/utils/format";
import { Building2, CalendarCheck, DollarSign, Percent, PlusCircle, Ticket, BarChart3 } from "lucide-react-native";

export default function PartnerDashboardScreen() {
  const router = useRouter();
  const dashboard = useQuery({
    queryKey: ["partner-dashboard"],
    queryFn: partnerApi.dashboard
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
      refreshControl={<RefreshControl refreshing={dashboard.isRefetching} onRefresh={() => void dashboard.refetch()} />}
    >
      <Text style={styles.headerTitle}>Tổng Quan Hoạt Động</Text>

      {dashboard.isLoading ? (
        <LoadingState label="Đang tải dữ liệu doanh thu..." />
      ) : dashboard.isError ? (
        <ErrorState message={dashboard.error.message} onRetry={() => void dashboard.refetch()} />
      ) : (
        <>
          <View style={styles.grid}>
            <MetricCard
              icon={<DollarSign size={24} color="#10b981" />}
              label="Doanh thu"
              value={formatCurrency(dashboard.data?.totalRevenue ?? 0)}
              bgColor="#ecfdf5"
            />
            <MetricCard
              icon={<CalendarCheck size={24} color="#3b82f6" />}
              label="Tổng lượt đặt"
              value={`${dashboard.data?.totalBookings ?? 0} đơn`}
              bgColor="#eff6ff"
            />
            <MetricCard
              icon={<Building2 size={24} color="#8b5cf6" />}
              label="Tổng số sân"
              value={`${dashboard.data?.totalCourts ?? 0} sân`}
              bgColor="#f5f3ff"
            />
            <MetricCard
              icon={<Percent size={24} color="#f59e0b" />}
              label="Tỷ lệ lấp đầy"
              value={`${dashboard.data?.occupancyRate ?? 75}%`}
              bgColor="#fffbeb"
            />
          </View>

          <Text style={styles.sectionTitle}>Quản Lý Nhanh</Text>
          <View style={{ gap: spacing.sm }}>
            <ActionRow
              icon={<Building2 size={20} color="#059669" />}
              title="Danh Sách & Quản Lý Sân"
              subtitle="Cấu hình thông tin sân, hình ảnh, dịch vụ"
              onPress={() => router.push("/partner/courts")}
            />
            <ActionRow
              icon={<CalendarCheck size={20} color="#2563eb" />}
              title="Danh Sách Đơn Đặt Sân"
              subtitle="Xem lịch đặt sân, xác nhận hoặc hủy đơn"
              onPress={() => router.push("/partner/bookings")}
            />
            <ActionRow
              icon={<Ticket size={20} color="#d97706" />}
              title="Quản Lý Voucher Ưu Đãi"
              subtitle="Tạo mã giảm giá dành riêng cho sân của bạn"
              onPress={() => router.push("/partner/vouchers")}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

function MetricCard({ icon, label, value, bgColor }: { icon: React.ReactNode; label: string; value: string; bgColor: string }) {
  return (
    <View style={[styles.metricCard, { backgroundColor: bgColor }]}>
      <View style={{ marginBottom: 8 }}>{icon}</View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function ActionRow({ icon, title, subtitle, onPress }: { icon: React.ReactNode; title: string; subtitle: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.actionRow}>
      <View style={styles.actionIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  headerTitle: {
    fontSize: typography.h2,
    fontWeight: "900",
    color: colors.ink
  },
  sectionTitle: {
    fontSize: typography.body,
    fontWeight: "900",
    color: colors.ink,
    marginTop: spacing.md
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  metricCard: {
    width: "47%",
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  metricLabel: {
    fontSize: typography.small,
    color: colors.muted,
    fontWeight: "700"
  },
  metricValue: {
    fontSize: typography.h3,
    fontWeight: "900",
    color: colors.ink,
    marginTop: 4
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: spacing.md
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center"
  },
  actionTitle: {
    fontSize: typography.body,
    fontWeight: "800",
    color: colors.ink
  },
  actionSubtitle: {
    fontSize: typography.small,
    color: colors.muted,
    marginTop: 2
  }
});
