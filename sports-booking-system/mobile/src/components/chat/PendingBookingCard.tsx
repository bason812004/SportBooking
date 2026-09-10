import { StyleSheet, Text, View } from "react-native";
import { Button } from "../Buttons";
import { colors, radii, shadows, spacing, typography } from "../../theme/tokens";
import { formatCurrency, formatDate } from "../../utils/format";
import { useConfirmPendingBooking } from "../../hooks/useChatbot";
import type { PendingBookingSummary } from "../../api/chatbot";

const PAYMENT_LABEL: Record<PendingBookingSummary["paymentType"], string> = {
  DEPOSIT: "Đặt cọc",
  FULL_PAYMENT: "Thanh toán toàn bộ",
  PAY_AT_COURT: "Thanh toán tại sân"
};

export function PendingBookingCard({ pendingBooking, onDismiss }: { pendingBooking: PendingBookingSummary; onDismiss: () => void }) {
  const confirmMutation = useConfirmPendingBooking();
  const isExpired = new Date(pendingBooking.expiresAt).getTime() < Date.now();

  const confirm = () => {
    if (!isExpired) confirmMutation.mutate(pendingBooking.pendingBookingId);
  };

  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <Text style={styles.title}>Đề xuất đặt sân</Text>
      <InfoRow label="Sân" value={pendingBooking.courtName} />
      <InfoRow label="Ngày" value={formatDate(pendingBooking.bookingDate)} />
      {pendingBooking.slots.map((slot, index) => (
        <InfoRow
          key={`${slot.startTime}-${slot.endTime}-${index}`}
          label={`Khung giờ${pendingBooking.slots.length > 1 ? ` ${index + 1}` : ""}`}
          value={`${slot.startTime} - ${slot.endTime}`}
        />
      ))}
      <InfoRow label="Thanh toán" value={PAYMENT_LABEL[pendingBooking.paymentType]} />
      <View style={styles.totalRow}>
        <Text style={styles.label}>Tổng tiền</Text>
        <Text style={styles.total}>{formatCurrency(pendingBooking.totalAmount)}</Text>
      </View>

      {confirmMutation.isSuccess ? (
        <Text style={styles.success}>Đặt sân thành công.</Text>
      ) : isExpired ? (
        <Text style={styles.expired}>Đề xuất đặt sân đã hết hạn.</Text>
      ) : (
        <View style={styles.actions}>
          <Button style={styles.confirmButton} loading={confirmMutation.isPending} onPress={confirm} accessibilityLabel="Xác nhận đặt sân">
            {confirmMutation.isPending ? "Đang xác nhận" : "Xác nhận"}
          </Button>
          <Button variant="secondary" style={styles.cancelButton} disabled={confirmMutation.isPending} onPress={onDismiss} accessibilityLabel="Hủy đề xuất đặt sân">
            Hủy
          </Button>
        </View>
      )}
      {confirmMutation.isError ? <Text style={styles.error}>{(confirmMutation.error as Error).message}</Text> : null}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.surfaceAlt,
    gap: spacing.sm,
    ...shadows.card
  },
  title: { color: colors.primaryDark, fontSize: typography.body, fontWeight: "900" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  label: { flex: 1, color: colors.muted, fontSize: typography.small },
  value: { flex: 1.4, color: colors.text, fontSize: typography.small, fontWeight: "700", textAlign: "right" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xs },
  total: { color: colors.primaryDark, fontSize: typography.h2, fontWeight: "900" },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  confirmButton: { flex: 1 },
  cancelButton: { minWidth: 90 },
  success: { color: colors.success, fontSize: typography.body, fontWeight: "900", textAlign: "center", marginTop: spacing.sm },
  expired: { color: colors.danger, fontSize: typography.small, fontWeight: "800", textAlign: "center", marginTop: spacing.sm },
  error: { color: colors.danger, fontSize: typography.tiny, textAlign: "center", marginTop: spacing.xs }
});
