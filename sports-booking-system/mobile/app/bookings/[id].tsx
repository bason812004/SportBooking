import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bookingApi } from "../../src/api/bookings";
import { queryKeys } from "../../src/api/queryKeys";
import { Button } from "../../src/components/Buttons";
import { StatusBadge } from "../../src/components/Badges";
import { Card, Screen, SectionHeader } from "../../src/components/Screen";
import { ErrorState, LoadingState } from "../../src/components/StateViews";
import { colors, spacing, typography } from "../../src/theme/tokens";
import { formatCurrency, formatDate, paymentStatusLabel, shortAddress, timeText } from "../../src/utils/format";

export default function BookingDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookingId = Array.isArray(id) ? id[0] : id;
  const booking = useQuery({ queryKey: queryKeys.booking(bookingId), queryFn: () => bookingApi.detail(bookingId), enabled: Boolean(bookingId) });
  const cancel = useMutation({
    mutationFn: () => bookingApi.cancel(bookingId, "Nguoi dung huy tu mobile app"),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.booking(bookingId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.bookings })
      ]);
      Alert.alert("Da huy booking", "Booking da duoc cap nhat.");
    },
    onError: (error) => Alert.alert("Khong huy duoc", error instanceof Error ? error.message : "Vui long thu lai")
  });

  if (booking.isLoading) return <Screen back><LoadingState label="Dang tai booking" /></Screen>;
  if (booking.isError) return <Screen back><ErrorState message={booking.error.message} onRetry={() => void booking.refetch()} /></Screen>;
  if (!booking.data) return <Screen back><ErrorState message="Khong tim thay booking" /></Screen>;

  const data = booking.data;
  const canCancel = !["COMPLETED", "NO_SHOW", "CANCELLED"].includes(data.bookingStatus);
  const canReview = data.bookingStatus === "COMPLETED" && !data.review;

  return (
    <Screen title="Chi tiet booking" subtitle={data.bookingCode} back>
      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>{data.court.name}</Text>
          <StatusBadge status={data.bookingStatus} />
        </View>
        <Text style={styles.meta}>{shortAddress(data.court)}</Text>
        <Text style={styles.meta}>{formatDate(data.bookingDate)} · {timeText(data.startTime)} - {timeText(data.endTime)}</Text>
      </Card>

      <SectionHeader title="Thanh toan" />
      <Card>
        <SummaryRow label="Trang thai" value={paymentStatusLabel(data.paymentStatus)} />
        <SummaryRow label="Tong tien" value={formatCurrency(data.totalPrice)} strong />
        <SummaryRow label="Coc" value={formatCurrency(data.depositAmount)} />
        <SummaryRow label="Voucher" value={`-${formatCurrency(data.voucherDiscountAmount)}`} />
      </Card>

      {data.bookingServices?.length ? (
        <>
          <SectionHeader title="Dich vu" />
          {data.bookingServices.map((service) => (
            <Card key={service.id}>
              <View style={styles.rowBetween}>
                <Text style={styles.meta}>{service.service.name} x {service.quantity}</Text>
                <Text style={styles.strong}>{formatCurrency(Number(service.price) * service.quantity)}</Text>
              </View>
            </Card>
          ))}
        </>
      ) : null}

      {data.note ? <Card><Text style={styles.meta}>Ghi chu: {data.note}</Text></Card> : null}

      <View style={styles.actions}>
        {canCancel ? (
          <Button
            variant="danger"
            loading={cancel.isPending}
            onPress={() => Alert.alert("Huy booking", "Ban co chac muon huy booking nay?", [
              { text: "Khong", style: "cancel" },
              { text: "Huy booking", style: "destructive", onPress: () => cancel.mutate() }
            ])}
          >
            Huy booking
          </Button>
        ) : null}
        {canReview ? <Button onPress={() => router.push({ pathname: "/reviews/create", params: { bookingId: data.id, courtId: data.court.id } })}>Danh gia san</Button> : null}
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
    fontWeight: "900"
  },
  total: {
    fontSize: typography.h2
  },
  actions: {
    gap: spacing.md
  }
});

