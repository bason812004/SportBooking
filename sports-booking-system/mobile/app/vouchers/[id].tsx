import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../src/api/queryKeys";
import { voucherApi } from "../../src/api/vouchers";
import { Button } from "../../src/components/Buttons";
import { StatusBadge } from "../../src/components/Badges";
import { Card, Screen } from "../../src/components/Screen";
import { ErrorState, LoadingState } from "../../src/components/StateViews";
import { useAuthStore } from "../../src/store/auth";
import { colors, spacing, typography } from "../../src/theme/tokens";
import { formatCurrency, formatDate } from "../../src/utils/format";

export default function VoucherDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const { id } = useLocalSearchParams<{ id: string }>();
  const voucherId = Array.isArray(id) ? id[0] : id;
  const voucher = useQuery({ queryKey: queryKeys.voucher(voucherId), queryFn: () => voucherApi.detail(voucherId), enabled: Boolean(voucherId) });
  const myVouchers = useQuery({ queryKey: queryKeys.myVouchers, queryFn: voucherApi.myVouchers, enabled: Boolean(user) });
  const claim = useMutation({
    mutationFn: voucherApi.claim,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.vouchers }),
        queryClient.invalidateQueries({ queryKey: queryKeys.myVouchers }),
        queryClient.invalidateQueries({ queryKey: queryKeys.voucher(voucherId) })
      ]);
      Alert.alert("Da nhan voucher", "Voucher da duoc luu vao vi cua ban.");
    },
    onError: (error) => Alert.alert("Khong nhan duoc voucher", error instanceof Error ? error.message : "Vui long thu lai")
  });

  if (voucher.isLoading) return <Screen back><LoadingState /></Screen>;
  if (voucher.isError) return <Screen back><ErrorState message={voucher.error.message} onRetry={() => void voucher.refetch()} /></Screen>;
  if (!voucher.data) return <Screen back><ErrorState message="Khong tim thay voucher" /></Screen>;

  const data = voucher.data;
  const claimed = myVouchers.data?.some((item) => item.id === data.id);

  return (
    <Screen title={data.title} subtitle={data.code} back>
      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.discount}>{data.discountType === "PERCENTAGE" ? `${data.discountValue}%` : formatCurrency(data.discountValue)}</Text>
          <StatusBadge status={claimed ? "CLAIMED" : data.status} kind="plain" />
        </View>
        <Text style={styles.body}>{data.description ?? "Voucher ap dung theo dieu kien cua he thong."}</Text>
      </Card>
      <Card>
        <Summary label="Don toi thieu" value={formatCurrency(data.minBookingAmount)} />
        <Summary label="Giam toi da" value={formatCurrency(data.maxDiscountAmount)} />
        <Summary label="Thoi han" value={`${formatDate(data.startDate)} - ${formatDate(data.endDate)}`} />
        <Summary label="Pham vi" value={data.court ? data.court.name : data.partner?.businessName ?? "Toan he thong"} />
      </Card>
      {data.court ? <Button variant="secondary" onPress={() => router.push(`/courts/${data.court?.id}`)}>Dung tai san nay</Button> : <Button variant="secondary" onPress={() => router.push("/(tabs)/courts")}>Tim san de dung</Button>}
      <Button
        disabled={claimed || claim.isPending}
        loading={claim.isPending}
        onPress={() => user ? claim.mutate(data.id) : router.push({ pathname: "/auth/login", params: { returnTo: `/vouchers/${data.id}` } })}
      >
        {claimed ? "Da nhan" : "Nhan voucher"}
      </Button>
    </Screen>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.rowBetween}>
      <Text style={styles.meta}>{label}</Text>
      <Text style={styles.strong}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  discount: {
    color: colors.primaryDark,
    fontSize: 34,
    fontWeight: "900"
  },
  body: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 22
  },
  meta: {
    color: colors.muted,
    fontSize: typography.small
  },
  strong: {
    flex: 1,
    textAlign: "right",
    color: colors.ink,
    fontWeight: "900"
  }
});

