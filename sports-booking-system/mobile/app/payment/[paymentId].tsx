import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { Alert, Linking, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { paymentApi } from "../../src/api/payments";
import { queryKeys } from "../../src/api/queryKeys";
import { Button } from "../../src/components/Buttons";
import { StatusBadge } from "../../src/components/Badges";
import { Card, Screen } from "../../src/components/Screen";
import { ErrorState, LoadingState } from "../../src/components/StateViews";
import { colors, spacing, typography } from "../../src/theme/tokens";
import { formatCurrency, formatDateTime } from "../../src/utils/format";
import { useLanguageStore } from "../../src/i18n";

export default function PaymentScreen() {
  const { t } = useLanguageStore();
  const router = useRouter();
  const queryClient = useQueryClient();
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

  // Once the payment settles, the booking's status changed on the server: drop the cached copies.
  const settledStatus = status.data?.status;
  const bookingId = detail.data?.bookingId ?? status.data?.bookingId;
  const isSettled = settledStatus != null && ["PAID", "FAILED", "EXPIRED", "CANCELLED"].includes(settledStatus);
  useEffect(() => {
    if (!isSettled || !bookingId) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
    void queryClient.invalidateQueries({ queryKey: queryKeys.booking(bookingId) });
    void queryClient.invalidateQueries({ queryKey: ["payment", id] });
    void queryClient.invalidateQueries({ queryKey: ["court-availability"] });
  }, [isSettled, bookingId, id, queryClient]);

  const devComplete = useMutation({
    mutationFn: () => paymentApi.devComplete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-status", id] });
      queryClient.invalidateQueries({ queryKey: ["payment", id] });
    },
    onError: (error) => Alert.alert("Loi", error instanceof Error ? error.message : "Khong the hoan tat thanh toan thu")
  });

  if (detail.isLoading) return <Screen back><LoadingState label="Dang tai thanh toan" /></Screen>;
  if (detail.isError) return <Screen back><ErrorState message={detail.error.message} onRetry={() => void detail.refetch()} /></Screen>;
  if (!detail.data) return <Screen back><ErrorState message="Khong tim thay thanh toan" /></Screen>;

  const currentStatus = settledStatus ?? detail.data.status;
  const isPayos = detail.data.provider === "PAYOS";
  const qrUrl = isPayos
    ? detail.data.qrPayload ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(detail.data.qrPayload)}` : null
    : detail.data.qrCodeUrl;
  const canPay = !["PAID", "FAILED", "EXPIRED", "CANCELLED"].includes(currentStatus);

  return (
    <Screen title="Thanh toan" subtitle={`Ma don ${detail.data.booking.bookingCode}`} back>
      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>{formatCurrency(detail.data.amount)}</Text>
          <StatusBadge status={currentStatus} kind="payment" />
        </View>
        <Text style={styles.meta}>Han thanh toan: {formatDateTime(detail.data.expiresAt)}</Text>
        {!isPayos && <Text style={styles.meta}>Noi dung: {detail.data.paymentReference}</Text>}
      </Card>

      {canPay && (qrUrl ? (
        <Card>
          <Image source={{ uri: qrUrl }} style={styles.qr} contentFit="contain" />
          <Text style={styles.meta}>Quet QR bang ung dung ngan hang, sau do man hinh se tu cap nhat trang thai.</Text>
        </Card>
      ) : (
        <Card>
          <Text style={styles.meta}>Provider thanh toan chua cau hinh QR. Vui long lien he san hoac chon tra tai san neu duoc ho tro.</Text>
        </Card>
      ))}

      {canPay && isPayos && detail.data.qrCodeUrl && (
        <Button onPress={() => Linking.openURL(detail.data!.qrCodeUrl!).catch(() => Alert.alert(t.common.error))}>
          {t.payment.openPayos}
        </Button>
      )}

      {currentStatus === "PAID" ? (
        <Button onPress={() => router.replace(`/bookings/${detail.data.bookingId}`)}>Xem booking</Button>
      ) : ["FAILED", "EXPIRED", "CANCELLED"].includes(currentStatus) ? (
        <Button variant="secondary" onPress={() => router.replace(`/bookings/${detail.data.bookingId}`)}>Kiem tra booking</Button>
      ) : (
        <Button variant="secondary" onPress={() => status.refetch().catch(() => Alert.alert("Chua cap nhat", "Hay thu lai sau vai giay."))}>Kiem tra lai</Button>
      )}

      {__DEV__ && !["PAID", "FAILED", "EXPIRED", "CANCELLED"].includes(currentStatus) ? (
        <Button variant="secondary" loading={devComplete.isPending} onPress={() => devComplete.mutate()}>
          Hoan tat (Test - chi hien o dev)
        </Button>
      ) : null}
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

