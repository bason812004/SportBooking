import { ScrollView, StyleSheet, Text, View, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { partnerApi } from "../../src/api/partner";
import { Card } from "../../src/components/Screen";
import { StatusBadge } from "../../src/components/Badges";
import { LoadingState, ErrorState, EmptyState } from "../../src/components/StateViews";
import { colors, typography, spacing } from "../../src/theme/tokens";
import { formatCurrency, formatDate } from "../../src/utils/format";

export default function PartnerBookingsScreen() {
  const bookings = useQuery({
    queryKey: ["partner-bookings"],
    queryFn: () => partnerApi.bookings()
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
      refreshControl={<RefreshControl refreshing={bookings.isRefetching} onRefresh={() => void bookings.refetch()} />}
    >
      <Text style={styles.title}>Đơn Đặt Sân</Text>

      {bookings.isLoading ? (
        <LoadingState label="Đang tải danh sách đơn đặt sân..." />
      ) : bookings.isError ? (
        <ErrorState message={bookings.error.message} onRetry={() => void bookings.refetch()} />
      ) : !bookings.data?.items?.length ? (
        <EmptyState title="Chưa có đơn hàng" message="Chưa có khách hàng nào đặt sân của bạn." />
      ) : (
        bookings.data.items.map((booking: any) => (
          <Card key={booking.id} style={{ gap: 8 }}>
            <View style={styles.rowBetween}>
              <Text style={{ fontWeight: "900", color: colors.ink }}>#{booking.bookingCode}</Text>
              <StatusBadge status={booking.bookingStatus} kind="booking" />
            </View>
            <Text style={{ fontWeight: "700", color: colors.ink }}>Khách hàng: {booking.user?.fullName ?? "Khách đặt sân"}</Text>
            <Text style={{ color: colors.muted, fontSize: typography.small }}>
              📅 Ngày chơi: {formatDate(booking.bookingDate)}
            </Text>
            <Text style={{ fontWeight: "900", color: colors.primaryDark, fontSize: typography.body }}>
              {formatCurrency(Number(booking.totalPrice ?? booking.totalAmount ?? 0))}
            </Text>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  title: {
    fontSize: typography.h3,
    fontWeight: "900",
    color: colors.ink
  }
});
