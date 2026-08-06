import { useState } from "react";
import { ScrollView, StyleSheet, Text, View, Alert, RefreshControl } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { partnerApi } from "../../src/api/partner";
import { Card } from "../../src/components/Screen";
import { Button } from "../../src/components/Buttons";
import { FormInput } from "../../src/components/Forms";
import { LoadingState, ErrorState, EmptyState } from "../../src/components/StateViews";
import { colors, typography, spacing } from "../../src/theme/tokens";
import { formatCurrency } from "../../src/utils/format";

export default function PartnerVouchersScreen() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [code, setCode] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [minBookingAmount, setMinBookingAmount] = useState("");

  const vouchers = useQuery({
    queryKey: ["partner-vouchers"],
    queryFn: partnerApi.vouchers
  });

  const createVoucher = useMutation({
    mutationFn: partnerApi.createVoucher,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["partner-vouchers"] });
      setShowAddModal(false);
      setCode("");
      setDiscountAmount("");
      setMinBookingAmount("");
      Alert.alert("Thành công", "Đã tạo mã giảm giá mới thành công!");
    },
    onError: (err) => Alert.alert("Lỗi", err instanceof Error ? err.message : "Không thể tạo voucher")
  });

  const handleCreate = () => {
    if (!code.trim() || !discountAmount.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập mã voucher và số tiền giảm.");
      return;
    }
    createVoucher.mutate({
      code: code.trim().toUpperCase(),
      discountAmount: Number(discountAmount),
      minBookingAmount: minBookingAmount ? Number(minBookingAmount) : 0,
      discountType: "FIXED_AMOUNT"
    });
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
      refreshControl={<RefreshControl refreshing={vouchers.isRefetching} onRefresh={() => void vouchers.refetch()} />}
    >
      <View style={styles.rowBetween}>
        <Text style={styles.title}>Voucher Của Bạn ({vouchers.data?.length ?? 0})</Text>
        <Button size="small" onPress={() => setShowAddModal(!showAddModal)}>
          {showAddModal ? "Hủy" : "+ Tạo Voucher"}
        </Button>
      </View>

      {showAddModal && (
        <Card style={{ gap: 12, borderLineWidth: 2, borderColor: colors.primary }}>
          <Text style={{ fontWeight: "900", fontSize: typography.body, color: colors.ink }}>Tạo Voucher Mới</Text>
          <FormInput label="Mã Voucher" value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="VD: INTR050" />
          <FormInput label="Số tiền giảm (VNĐ)" value={discountAmount} onChangeText={setDiscountAmount} keyboardType="number-pad" placeholder="50000" />
          <FormInput label="Đơn tối thiểu (VNĐ)" value={minBookingAmount} onChangeText={setMinBookingAmount} keyboardType="number-pad" placeholder="200000" />
          <Button loading={createVoucher.isPending} onPress={handleCreate}>
            Phát Hành Voucher
          </Button>
        </Card>
      )}

      {vouchers.isLoading ? (
        <LoadingState label="Đang tải danh sách voucher..." />
      ) : vouchers.isError ? (
        <ErrorState message={vouchers.error.message} onRetry={() => void vouchers.refetch()} />
      ) : !vouchers.data?.length ? (
        <EmptyState title="Chưa có voucher" message="Bấm '+ Tạo Voucher' để khuyến mãi thu hút thêm khách hàng." />
      ) : (
        vouchers.data.map((voucher: any) => (
          <Card key={voucher.id} style={{ gap: 6 }}>
            <View style={styles.rowBetween}>
              <Text style={{ fontWeight: "900", color: colors.primaryDark, fontSize: typography.h3 }}>
                {voucher.code}
              </Text>
              <Text style={{ fontWeight: "800", color: colors.ink }}>
                Giảm {formatCurrency(Number(voucher.discountAmount ?? 0))}
              </Text>
            </View>
            {voucher.minBookingAmount ? (
              <Text style={{ fontSize: typography.small, color: colors.muted }}>
                Đơn tối thiểu: {formatCurrency(Number(voucher.minBookingAmount))}
              </Text>
            ) : null}
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
