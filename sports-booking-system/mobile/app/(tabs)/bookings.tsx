import { useState } from "react";
import { useRouter } from "expo-router";
import { FlatList, ScrollView, StyleSheet, View } from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import { bookingApi } from "../../src/api/bookings";
import { nextPageParam } from "../../src/api/client";
import { queryKeys } from "../../src/api/queryKeys";
import { Button, Chip } from "../../src/components/Buttons";
import { BookingCard } from "../../src/components/Cards";
import { Screen } from "../../src/components/Screen";
import { EmptyState, ErrorState, LoadMoreFooter, SkeletonCard } from "../../src/components/StateViews";
import { useAuthStore } from "../../src/store/auth";
import { spacing } from "../../src/theme/tokens";

// Each tab groups the backend booking statuses a customer reads as one state.
const STATUS_FILTERS: Array<{ key: string; label: string; statuses?: string[] }> = [
  { key: "ALL", label: "Tất cả" },
  { key: "PENDING_PAYMENT", label: "Chờ thanh toán", statuses: ["PENDING_PAYMENT"] },
  { key: "CONFIRMED", label: "Đã xác nhận", statuses: ["CONFIRMED", "DEPOSIT_PAID"] },
  { key: "IN_PROGRESS", label: "Đang chơi", statuses: ["IN_PROGRESS", "CHECKOUT_PENDING"] },
  { key: "COMPLETED", label: "Hoàn tất", statuses: ["COMPLETED"] },
  { key: "CANCELLED", label: "Đã hủy", statuses: ["CANCELLED", "REJECTED", "EXPIRED", "NO_SHOW"] }
];

export default function MyBookingsScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [statusFilter, setStatusFilter] = useState("ALL");

  // The server filters by status, so each tab pages through its own list.
  const activeStatuses = STATUS_FILTERS.find((f) => f.key === statusFilter)?.statuses;
  const bookings = useInfiniteQuery({
    queryKey: queryKeys.bookingList(statusFilter),
    queryFn: ({ pageParam }) => bookingApi.listMine(pageParam, activeStatuses),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
    enabled: Boolean(user)
  });

  const loadMore = () => {
    if (bookings.hasNextPage && !bookings.isFetchingNextPage) void bookings.fetchNextPage();
  };

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

  const items = bookings.data?.pages.flatMap((page) => page.items) ?? [];

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
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <BookingCard booking={item} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshing={bookings.isRefetching && !bookings.isFetchingNextPage}
          onRefresh={() => void bookings.refetch()}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={<LoadMoreFooter hasMore={bookings.hasNextPage} loading={bookings.isFetchingNextPage} onPress={loadMore} />}
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
