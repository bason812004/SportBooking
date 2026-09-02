import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bookingApi } from "../../src/api/bookings";
import { queryKeys } from "../../src/api/queryKeys";
import { Button } from "../../src/components/Buttons";
import { StatusBadge } from "../../src/components/Badges";
import { Card, Screen, SectionHeader } from "../../src/components/Screen";
import { ErrorState, LoadingState } from "../../src/components/StateViews";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";
import { formatCurrency, formatDate, paymentStatusLabel, shortAddress, timeText } from "../../src/utils/format";

export default function BookingDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookingId = Array.isArray(id) ? id[0] : id;

  const booking = useQuery({
    queryKey: queryKeys.booking(bookingId),
    queryFn: () => bookingApi.detail(bookingId),
    enabled: Boolean(bookingId)
  });

  const cancel = useMutation({
    mutationFn: () => bookingApi.cancel(bookingId, "Người dùng hủy từ mobile app"),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.booking(bookingId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.bookings })
      ]);
      Alert.alert("Đã hủy đơn", "Đơn đặt sân đã được cập nhật trạng thái hủy.");
    },
    onError: (error) => Alert.alert("Không thể hủy", error instanceof Error ? error.message : "Vui lòng thử lại sau.")
  });

  if (booking.isLoading) return <Screen back><LoadingState label="Đang tải chi tiết đơn..." /></Screen>;
  if (booking.isError) return <Screen back><ErrorState message={booking.error.message} onRetry={() => void booking.refetch()} /></Screen>;
  if (!booking.data) return <Screen back><ErrorState message="Không tìm thấy đơn đặt sân." /></Screen>;

  const data = booking.data;
  const canCancel = !["COMPLETED", "NO_SHOW", "CANCELLED"].includes(data.bookingStatus);
  const canPay = !["PAID", "REFUNDED"].includes(data.paymentStatus);
  const canReview = data.bookingStatus === "COMPLETED" && !data.review;
  const paymentId = data.payments?.[0]?.id;

  return (
    <Screen title="Chi Tiết Đơn Đặt" subtitle={`Mã đơn: #${data.bookingCode}`} back>
      {/* Court Info Card */}
      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>{data.court?.name}</Text>
          <StatusBadge status={data.bookingStatus} />
        </View>
        <Text style={styles.meta}>{shortAddress(data.court)}</Text>
        <Text style={styles.meta}>{formatDate(data.bookingDate)} · {timeText(data.startTime)} - {timeText(data.endTime)}</Text>
      </Card>

      {/* Slots Breakdown */}
      {data.bookingSlots && data.bookingSlots.length > 0 && (
        <>
          <SectionHeader title={`Khung giờ chi tiết (${data.bookingSlots.length})`} />
          <Card style={{ gap: spacing.xs }}>
            {data.bookingSlots.map((slot, index) => (
              <View key={slot.id || index} style={styles.slotRow}>
                <Text style={styles.slotText}>
                  {slot.bookingDate ? `${formatDate(slot.bookingDate)} · ` : ""}
                  {timeText(slot.startTime)} - {timeText(slot.endTime)}
                  {slot.court_surfaces?.name ? ` (${slot.court_surfaces.name})` : ""}
                </Text>
                {slot.slotPrice != null && (
                  <Text style={styles.strong}>{formatCurrency(slot.slotPrice)}</Text>
                )}
              </View>
            ))}
          </Card>
        </>
      )}

      {/* Services Included */}
      {data.bookingServices && data.bookingServices.length > 0 && (
        <>
          <SectionHeader title="Dịch vụ đi kèm" />
          <Card style={{ gap: spacing.xs }}>
            {data.bookingServices.map((service) => (
              <View key={service.id} style={styles.rowBetween}>
                <Text style={styles.meta}>{service.service.name} x {service.quantity}</Text>
                <Text style={styles.strong}>{formatCurrency(Number(service.price) * service.quantity)}</Text>
              </View>
            ))}
          </Card>
        </>
      )}

      {/* Payment Summary */}
      <SectionHeader title="Thông tin thanh toán" />
      <Card style={{ gap: spacing.xs }}>
        <SummaryRow label="Trạng thái thanh toán" value={paymentStatusLabel(data.paymentStatus)} />
        <SummaryRow label="Tạm tính" value={formatCurrency(data.subtotal ?? data.totalPrice)} />
        {Number(data.voucherDiscountAmount ?? 0) > 0 && (
          <SummaryRow label="Giảm giá voucher" value={`-${formatCurrency(data.voucherDiscountAmount)}`} />
        )}
        {data.depositAmount ? (
          <SummaryRow label="Tiền cọc" value={formatCurrency(data.depositAmount)} />
        ) : null}
        <SummaryRow label="Tổng thanh toán" value={formatCurrency(data.totalPrice)} strong />
      </Card>

      {/* Note */}
      {data.note ? (
        <>
          <SectionHeader title="Ghi chú" />
          <Card>
            <Text style={styles.meta}>{data.note}</Text>
          </Card>
        </>
      ) : null}

      {/* Cancellation Reason */}
      {data.cancelReason ? (
        <Card style={styles.cancelCard}>
          <Text style={styles.cancelTitle}>Lý do hủy:</Text>
          <Text style={styles.cancelText}>{data.cancelReason}</Text>
        </Card>
      ) : null}

      {/* Actions */}
      <View style={styles.actions}>
        {canPay && paymentId && (
          <Button
            variant="primary"
            onPress={() => router.push(`/payment/${paymentId}`)}
          >
            Thanh toán ngay
          </Button>
        )}

        <Button
          variant="secondary"
          onPress={() => router.push(`/courts/${data.court.id}`)}
        >
          Đặt lại sân này
        </Button>

        {canReview && (
          <Button onPress={() => router.push({ pathname: "/reviews/create", params: { bookingId: data.id, courtId: data.court.id } })}>
            Đánh giá sân
          </Button>
        )}

        {canCancel && (
          <Button
            variant="danger"
            loading={cancel.isPending}
            onPress={() =>
              Alert.alert("Hủy đặt sân", "Bạn có chắc chắn muốn hủy đơn đặt sân này?", [
                { text: "Không", style: "cancel" },
                { text: "Hủy đơn", style: "destructive", onPress: () => cancel.mutate() }
              ])
            }
          >
            Hủy đơn đặt sân
          </Button>
        )}
      </View>
    </Screen>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.rowBetween}>
      <Text style={styles.meta}>{label}</Text>
      <Text style={[styles.strong, strong && styles.total]}>{value}</Text>
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
  title: {
    flex: 1,
    color: colors.ink,
    fontSize: typography.h2,
    fontWeight: "900"
  },
  meta: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 20
  },
  strong: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: "900"
  },
  total: {
    fontSize: typography.h2,
    color: colors.primaryDark
  },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4
  },
  slotText: {
    fontSize: typography.small,
    color: colors.ink,
    fontWeight: "700"
  },
  cancelCard: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger
  },
  cancelTitle: {
    color: colors.danger,
    fontSize: typography.small,
    fontWeight: "900"
  },
  cancelText: {
    color: colors.ink,
    fontSize: typography.small,
    marginTop: 2
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.xxl
  }
});
