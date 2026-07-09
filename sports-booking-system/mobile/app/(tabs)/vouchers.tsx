import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../src/api/queryKeys";
import { voucherApi } from "../../src/api/vouchers";
import { Chip } from "../../src/components/Buttons";
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
      Alert.alert("Da nhan voucher", "Voucher da duoc luu vao vi cua ban.");
    },
    onError: (error) => Alert.alert("Khong nhan duoc voucher", error instanceof Error ? error.message : "Vui long thu lai")
  });

  const claimedIds = new Set(myVouchers.data?.map((item) => item.id));
  const publicItems = (vouchers.data ?? []).filter((item) => `${item.code} ${item.title}`.toLowerCase().includes(search.toLowerCase()));
  const myItems = (myVouchers.data ?? []).filter((item) => `${item.code} ${item.title}`.toLowerCase().includes(search.toLowerCase()));
  const data = tab === "mine" ? myItems : publicItems;

  return (
    <Screen title="Voucher" subtitle="Nhan va quan ly voucher da claim." scroll={false}>
      <SearchInput value={search} onChangeText={setSearch} placeholder="Tim code hoac ten voucher" />
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Chip label="Cong khai" active={tab === "public"} onPress={() => setTab("public")} />
        <Chip label="Cua toi" active={tab === "mine"} onPress={() => user ? setTab("mine") : router.push({ pathname: "/auth/login", params: { returnTo: "/(tabs)/vouchers" } })} />
      </View>
      {(tab === "public" ? vouchers : myVouchers).isLoading ? (
        <View style={{ gap: spacing.md }}>{Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)}</View>
      ) : (tab === "public" ? vouchers : myVouchers).isError ? (
        <ErrorState message={(tab === "public" ? vouchers.error : myVouchers.error)?.message ?? "Loi tai voucher"} onRetry={() => void (tab === "public" ? vouchers.refetch() : myVouchers.refetch())} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => String("userVoucherId" in item ? item.userVoucherId : item.id)}
          renderItem={({ item }) => (
            <VoucherCard
              voucher={item}
              claimed={claimedIds.has(item.id)}
              loading={claim.isPending}
              onClaim={tab === "public" ? () => user ? claim.mutate(item.id) : router.push({ pathname: "/auth/login", params: { returnTo: "/(tabs)/vouchers" } }) : undefined}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          contentContainerStyle={{ paddingBottom: 128 }}
          refreshing={(tab === "public" ? vouchers : myVouchers).isRefetching}
          onRefresh={() => void (tab === "public" ? vouchers.refetch() : myVouchers.refetch())}
          ListEmptyComponent={<EmptyState title="Khong co voucher" message={tab === "mine" ? "Voucher da nhan se hien tai day." : "Thu tim tu khoa khac."} />}
        />
      )}
    </Screen>
  );
}
