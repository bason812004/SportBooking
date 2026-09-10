import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../src/api/queryKeys";
import { voucherApi } from "../../src/api/vouchers";
import { Button, Chip } from "../../src/components/Buttons";
import { VoucherCard } from "../../src/components/Cards";
import { SearchInput } from "../../src/components/Forms";
import { Screen } from "../../src/components/Screen";
import { EmptyState, ErrorState, SkeletonCard } from "../../src/components/StateViews";
import { useAuthStore } from "../../src/store/auth";
import { spacing } from "../../src/theme/tokens";

export default function VouchersScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [tab, setTab] = useState<"public" | "mine">("public");
  const [search, setSearch] = useState("");

  const vouchers = useQuery({ queryKey: queryKeys.vouchers, queryFn: voucherApi.list });
  const myVouchers = useQuery({ queryKey: queryKeys.myVouchers, queryFn: voucherApi.myVouchers, enabled: Boolean(user) });

  const claim = useMutation({
    mutationFn: voucherApi.claim,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.vouchers }),
        queryClient.invalidateQueries({ queryKey: queryKeys.myVouchers })
      ]);
      Alert.alert("Thành công", "Voucher đã được lưu vào ví của bạn.");
    },
    onError: (error) => Alert.alert("Không thể nhận", error instanceof Error ? error.message : "Vui lòng thử lại sau.")
  });

  const claimAll = useMutation({
    mutationFn: voucherApi.claimAll,
    onSuccess: async (res) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.vouchers }),
        queryClient.invalidateQueries({ queryKey: queryKeys.myVouchers })
      ]);
      Alert.alert("Hoàn tất", `Đã nhận thành công ${res.claimedCount} voucher mới!`);
    },
    onError: (error) => Alert.alert("Không thể nhận tất cả", error instanceof Error ? error.message : "Vui lòng thử lại.")
  });

  const claimedIds = new Set(myVouchers.data?.map((item) => item.id));
  const publicItems = (vouchers.data ?? []).filter((item) =>
    `${item.code} ${item.title}`.toLowerCase().includes(search.toLowerCase())
  );
  const myItems = (myVouchers.data ?? []).filter((item) =>
    `${item.code} ${item.title}`.toLowerCase().includes(search.toLowerCase())
  );
  const data = tab === "mine" ? myItems : publicItems;

  return (
    <Screen
      title="Kho Voucher"
      subtitle="Nhận mã giảm giá và quản lý ưu đãi của bạn."
      scroll={false}
      right={
        tab === "public" && user ? (
          <Button
            variant="primary"
            loading={claimAll.isPending}
            onPress={() => claimAll.mutate()}
          >
            Nhận tất cả
          </Button>
        ) : undefined
      }
    >
      <SearchInput value={search} onChangeText={setSearch} placeholder="Tìm mã voucher hoặc tên ưu đãi..." />

      <View style={styles.tabsRow}>
        <Chip label="Tất cả Voucher" active={tab === "public"} onPress={() => setTab("public")} />
        <Chip
          label={`Ví voucher của tôi (${myVouchers.data?.length ?? 0})`}
          active={tab === "mine"}
          onPress={() => (user ? setTab("mine") : router.push({ pathname: "/auth/login", params: { returnTo: "/(tabs)/vouchers" } }))}
        />
      </View>

      {(tab === "public" ? vouchers : myVouchers).isLoading ? (
        <View style={{ gap: spacing.md }}>
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </View>
      ) : (tab === "public" ? vouchers : myVouchers).isError ? (
        <ErrorState
          message={(tab === "public" ? vouchers.error : myVouchers.error)?.message ?? "Lỗi tải voucher"}
          onRetry={() => void (tab === "public" ? vouchers.refetch() : myVouchers.refetch())}
        />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => String("userVoucherId" in item ? item.userVoucherId : item.id)}
          renderItem={({ item }) => (
            <VoucherCard
              voucher={item}
              claimed={claimedIds.has(item.id)}
              loading={claim.isPending}
              onClaim={
                tab === "public"
                  ? () =>
                      user
                        ? claim.mutate(item.id)
                        : router.push({ pathname: "/auth/login", params: { returnTo: "/(tabs)/vouchers" } })
                  : undefined
              }
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshing={(tab === "public" ? vouchers : myVouchers).isRefetching}
          onRefresh={() => void (tab === "public" ? vouchers.refetch() : myVouchers.refetch())}
          ListEmptyComponent={
            <EmptyState
              title="Không có voucher nào"
              message={tab === "mine" ? "Bạn chưa có voucher nào trong ví. Hãy nhận voucher từ mục công khai!" : "Hiện không có voucher phù hợp."}
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginVertical: spacing.xs
  }
});
