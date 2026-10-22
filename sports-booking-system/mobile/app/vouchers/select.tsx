import { useLocalSearchParams, useRouter } from "expo-router";
import { FlatList, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../src/api/queryKeys";
import { voucherApi } from "../../src/api/vouchers";
import { VoucherCard } from "../../src/components/Cards";
import { Screen } from "../../src/components/Screen";
import { EmptyState, ErrorState, SkeletonCard } from "../../src/components/StateViews";
import { spacing } from "../../src/theme/tokens";

export default function SelectVoucherScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ courtId?: string; date?: string; slots?: string }>();
  const vouchers = useQuery({ queryKey: queryKeys.myVouchers, queryFn: voucherApi.myVouchers });
  const available = (vouchers.data ?? []).filter((item) => item.status === "CLAIMED");

  return (
    <Screen title="Chon voucher" subtitle="Voucher se duoc backend validate lai trong quote." back scroll={false}>
      {vouchers.isLoading ? (
        <View style={{ gap: spacing.md }}>{Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)}</View>
      ) : vouchers.isError ? (
        <ErrorState message={vouchers.error.message} onRetry={() => void vouchers.refetch()} />
      ) : (
        <FlatList
          data={available}
          keyExtractor={(item) => item.userVoucherId}
          renderItem={({ item }) => (
            <VoucherCard
              voucher={item}
              onClaim={() => router.replace({ pathname: "/booking/[courtId]", params: { courtId: params.courtId, date: params.date, slots: params.slots, voucherId: item.id } })}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          contentContainerStyle={{ paddingBottom: 128 }}
          ListEmptyComponent={<EmptyState title="Khong co voucher kha dung" message="Hay nhan voucher truoc khi ap dung." />}
        />
      )}
    </Screen>
  );
}

