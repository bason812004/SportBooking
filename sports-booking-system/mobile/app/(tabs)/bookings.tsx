import { useRouter } from "expo-router";
import { FlatList, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { bookingApi } from "../../src/api/bookings";
import { queryKeys } from "../../src/api/queryKeys";
import { Button } from "../../src/components/Buttons";
import { BookingCard } from "../../src/components/Cards";
import { Screen } from "../../src/components/Screen";
import { EmptyState, ErrorState, SkeletonCard } from "../../src/components/StateViews";
import { useAuthStore } from "../../src/store/auth";
import { spacing } from "../../src/theme/tokens";

export default function MyBookingsScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const bookings = useQuery({ queryKey: queryKeys.bookings, queryFn: bookingApi.listMine, enabled: Boolean(user) });

  if (!user) {
    return (
      <Screen title="Dat san cua toi" subtitle="Dang nhap de xem lich da dat.">
        <EmptyState title="Ban chua dang nhap" message="Lich dat san se duoc dong bo tu tai khoan cua ban." actionLabel="Dang nhap" onAction={() => router.push({ pathname: "/auth/login", params: { returnTo: "/(tabs)/bookings" } })} />
      </Screen>
    );
  }

  return (
    <Screen title="Dat san cua toi" subtitle="Theo doi, huy hoac danh gia lich choi." scroll={false}>
      {bookings.isLoading ? (
        <View style={{ gap: spacing.md }}>{Array.from({ length: 5 }).map((_, index) => <SkeletonCard key={index} />)}</View>
      ) : bookings.isError ? (
        <ErrorState message={bookings.error.message} onRetry={() => void bookings.refetch()} />
      ) : (
        <FlatList
          data={bookings.data?.items ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <BookingCard booking={item} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          contentContainerStyle={{ paddingBottom: 128 }}
          refreshing={bookings.isRefetching}
          onRefresh={() => void bookings.refetch()}
          ListEmptyComponent={<EmptyState title="Chua co booking" message="Tim san va tao lich choi dau tien." actionLabel="Tim san" onAction={() => router.push("/(tabs)/courts")} />}
        />
      )}
      <Button variant="ghost" onPress={() => router.push("/(tabs)/courts")}>Tim san de dat</Button>
    </Screen>
  );
}

