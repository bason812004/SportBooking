import { useState } from "react";
import { useRouter } from "expo-router";
import { FlatList, ScrollView, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { bookingApi } from "../../src/api/bookings";
import { queryKeys } from "../../src/api/queryKeys";
import { Button, Chip } from "../../src/components/Buttons";
import { BookingCard } from "../../src/components/Cards";
import { Screen } from "../../src/components/Screen";
import { EmptyState, ErrorState, SkeletonCard } from "../../src/components/StateViews";
import { useAuthStore } from "../../src/store/auth";
import { spacing } from "../../src/theme/tokens";

const STATUS_FILTERS = [
  { key: "ALL", label: "Tất cả" },
  { key: "PENDING_PAYMENT", label: "Chờ thanh toán" },
  { key: "CONFIRMED", label: "Đã xác nhận" },
  { key: "COMPLETED", label: "Hoàn tất" },
  { key: "CANCELLED", label: "Đã hủy" }
];

export default function MyBookingsScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const bookings = useQuery({
    queryKey: queryKeys.bookings,
    queryFn: bookingApi.listMine,
    enabled: Boolean(user)
  });

  if (!user) {
    return (
      <Screen title="Lịch Đặt Của Tôi" subtitle="Đăng nhập để xem lịch đã đặt.">
        <EmptyState
          title="Bạn chưa đăng nhập"
          message="Lịch đặt sân sẽ được đồng bộ từ tài khoản của bạn."
          actionLabel="Đăng nhập ngay"
          onAction={() => router.push({ pathname: "/auth/login", params: { returnTo: "/(tabs)/bookings" } })}
        />
      </Screen>
    );
  }

  const items = bookings.data?.items ?? [];
  const filtered = items.filter((b) => {
    if (statusFilter === "ALL") return true;
    if (statusFilter === "PENDING_PAYMENT") return b.paymentStatus === "UNPAID" || b.bookingStatus === "PENDING_PAYMENT";
    return b.bookingStatus === statusFilter;
  });

  return (
    <Screen title="Lịch Đặt Của Tôi" subtitle="Theo dõi trạng thái, thanh toán và quản lý lịch chơi." scroll={false}>
      {/* Filter Chips */}
      <View style={styles.chipsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {STATUS_FILTERS.map((f) => (
            <Chip
              key={f.key}
              label={f.label}
              active={statusFilter === f.key}
              onPress={() => setStatusFilter(f.key)}
            />
          ))}
        </ScrollView>
      </View>

      {bookings.isLoading ? (
        <View style={{ gap: spacing.md }}>
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </View>
      ) : bookings.isError ? (
        <ErrorState message={bookings.error.message} onRetry={() => void bookings.refetch()} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <BookingCard booking={item} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshing={bookings.isRefetching}
          onRefresh={() => void bookings.refetch()}
          ListEmptyComponent={
            <EmptyState
              title="Không có lịch đặt"
              message={statusFilter === "ALL" ? "Bạn chưa có đơn đặt sân nào. Hãy tìm sân và đặt ngay!" : "Không có đơn nào theo trạng thái này."}
              actionLabel="Khám phá sân ngay"
              onAction={() => router.push("/(tabs)/courts")}
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipsContainer: {
    marginBottom: spacing.md
  }
});
