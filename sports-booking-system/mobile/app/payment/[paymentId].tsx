import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { paymentApi } from "../../src/api/payments";
import { Button } from "../../src/components/Buttons";
import { StatusBadge } from "../../src/components/Badges";
import { Card, Screen } from "../../src/components/Screen";
import { ErrorState, LoadingState } from "../../src/components/StateViews";
import { colors, spacing, typography } from "../../src/theme/tokens";
import { formatCurrency, formatDateTime } from "../../src/utils/format";

export default function PaymentScreen() {
  const router = useRouter();
  const { paymentId } = useLocalSearchParams<{ paymentId: string }>();
  const id = Array.isArray(paymentId) ? paymentId[0] : paymentId;
  const detail = useQuery({ queryKey: ["payment", id], queryFn: () => paymentApi.detail(id), enabled: Boolean(id) });
  const status = useQuery({
    queryKey: ["payment-status", id],
    queryFn: () => paymentApi.status(id),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const data = query.state.data;
      return data && ["PAID", "FAILED", "EXPIRED", "CANCELLED"].includes(data.status) ? false : 2000;
    }
  });

  if (detail.isLoading) return <Screen back><LoadingState label="Dang tai thanh toan" /></Screen>;
  if (detail.isError) return <Screen back><ErrorState message={detail.error.message} onRetry={() => void detail.refetch()} /></Screen>;
  if (!detail.data) return <Screen back><ErrorState message="Khong tim thay thanh toan" /></Screen>;

  const currentStatus = status.data?.status ?? detail.data.status;

  return (
    <Screen title="Thanh toan" subtitle={`Ma don ${detail.data.booking.bookingCode}`} back>
      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>{formatCurrency(detail.data.amount)}</Text>
          <StatusBadge status={currentStatus} kind="payment" />
        </View>
        <Text style={styles.meta}>Han thanh toan: {formatDateTime(detail.data.expiresAt)}</Text>
        <Text style={styles.meta}>Noi dung: {detail.data.paymentReference}</Text>
      </Card>

      {detail.data.qrCodeUrl ? (
        <Card>
          <Image source={{ uri: detail.data.qrCodeUrl }} style={styles.qr} contentFit="contain" />
          <Text style={styles.meta}>Quet QR bang ung dung ngan hang, sau do man hinh se tu cap nhat trang thai.</Text>
        </Card>
      ) : (
        <Card>
          <Text style={styles.meta}>Provider thanh toan chua cau hinh QR. Vui long lien he san hoac chon tra tai san neu duoc ho tro.</Text>
        </Card>
      )}

      {currentStatus === "PAID" ? (
        <Button onPress={() => router.replace(`/bookings/${detail.data.bookingId}`)}>Xem booking</Button>
      ) : ["FAILED", "EXPIRED", "CANCELLED"].includes(currentStatus) ? (
        <Button variant="secondary" onPress={() => router.replace(`/bookings/${detail.data.bookingId}`)}>Kiem tra booking</Button>
      ) : (
        <Button variant="secondary" onPress={() => status.refetch().catch(() => Alert.alert("Chua cap nhat", "Hay thu lai sau vai giay."))}>Kiem tra lai</Button>
      )}
    </Screen>
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
    color: colors.ink,
    fontSize: typography.h1,
    fontWeight: "900"
  },
  meta: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 20
  },
  qr: {
    height: 260,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16
  }
});

