import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bookingApi, type BookingSlotPayload } from "../../src/api/bookings";
import { courtApi } from "../../src/api/courts";
import { queryKeys } from "../../src/api/queryKeys";
import type { AvailabilitySlot } from "../../src/api/types";
import { Button, Chip } from "../../src/components/Buttons";
import { FormInput } from "../../src/components/Forms";
import { QuantityStepper } from "../../src/components/QuantityStepper";
import { Card, Screen, SectionHeader } from "../../src/components/Screen";
import { DateStrip, SlotPicker } from "../../src/components/SlotPicker";
import { ErrorState, LoadingState } from "../../src/components/StateViews";
import { StickyBottomAction } from "../../src/components/StickyBottomAction";
import { useAuthStore } from "../../src/store/auth";
import { colors, spacing, typography } from "../../src/theme/tokens";
import { formatCurrency, shortAddress, todayKey } from "../../src/utils/format";

type PaymentType = "PAY_AT_COURT" | "DEPOSIT" | "FULL_PAYMENT";

export default function BookingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const params = useLocalSearchParams<{ courtId: string; date?: string; slots?: string; voucherId?: string }>();
  const courtId = Array.isArray(params.courtId) ? params.courtId[0] : params.courtId;
  const [date, setDate] = useState(params.date ?? todayKey());
  const [selectedSlots, setSelectedSlots] = useState<BookingSlotPayload[]>(() => parseSlots(params.slots));
  const [serviceQuantities, setServiceQuantities] = useState<Record<string, number>>({});
  const [voucherCodeInput, setVoucherCodeInput] = useState("");
  const [voucherCode, setVoucherCode] = useState<string | undefined>(undefined);
  const [paymentType, setPaymentType] = useState<PaymentType>("PAY_AT_COURT");
  const [note, setNote] = useState("");

  const court = useQuery({ queryKey: queryKeys.court(courtId), queryFn: () => courtApi.detail(courtId), enabled: Boolean(courtId) });
  const availability = useQuery({ queryKey: queryKeys.courtAvailability(courtId, date), queryFn: () => courtApi.availability(courtId, date), enabled: Boolean(courtId) });
  const services = useMemo(
    () => Object.entries(serviceQuantities).filter(([, quantity]) => quantity > 0).map(([serviceId, quantity]) => ({ serviceId, quantity })),
    [serviceQuantities]
  );
  const quotePayload = useMemo(() => ({
    courtId,
    bookingDate: date,
    slots: selectedSlots,
    services,
    voucherId: params.voucherId,
    voucherCode
  }), [courtId, date, selectedSlots, services, params.voucherId, voucherCode]);
  const quote = useQuery({
    queryKey: ["booking-quote", quotePayload],
    queryFn: () => bookingApi.quote(quotePayload),
    enabled: Boolean(user && courtId && selectedSlots.length > 0)
  });
  const checkout = useMutation({
    mutationFn: bookingApi.checkout,
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.bookings }),
        queryClient.invalidateQueries({ queryKey: queryKeys.courtAvailability(courtId, date) })
      ]);
      if (result.paymentId) {
        router.replace(`/payment/${result.paymentId}`);
      } else {
        router.replace(`/bookings/${result.bookingId}`);
      }
    },
    onError: (error) => Alert.alert("Khong tao duoc booking", error instanceof Error ? error.message : "Vui long thu lai")
  });

  if (!user) {
    return (
      <Screen title="Dang nhap de dat san" subtitle="Sau khi dang nhap, ban se quay lai man hinh dat san." back>
        <Card>
          <Text style={styles.body}>Booking can tai khoan USER de backend xac thuc quyen va tinh gia.</Text>
          <Button onPress={() => router.push({ pathname: "/auth/login", params: { returnTo: `/booking/${courtId}` } })}>Dang nhap</Button>
        </Card>
      </Screen>
    );
  }

  function toggleSlot(slot: AvailabilitySlot) {
    setSelectedSlots((current) => {
      const exists = current.some((item) => item.startTime === slot.startTime && item.endTime === slot.endTime);
      return exists ? current.filter((item) => item.startTime !== slot.startTime || item.endTime !== slot.endTime) : [...current, { startTime: slot.startTime, endTime: slot.endTime }].sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
  }

  const selectedAvailabilitySlots = selectedSlots.map((slot) => ({ ...slot, status: "AVAILABLE", price: 0, bookingId: null } satisfies AvailabilitySlot));

  return (
    <View style={{ flex: 1 }}>
      <Screen title="Dat san" subtitle={court.data ? `${court.data.name} · ${shortAddress(court.data)}` : "Chon lich va thanh toan"} back>
        {court.isLoading ? <LoadingState /> : court.isError ? <ErrorState message={court.error.message} onRetry={() => void court.refetch()} /> : null}

        <SectionHeader title="Ngay choi" />
        <DateStrip value={date} onChange={(nextDate) => { setDate(nextDate); setSelectedSlots([]); }} />

        <SectionHeader title="Khung gio" />
        {availability.isLoading ? <LoadingState label="Dang tai lich san" /> : availability.isError ? <ErrorState message={availability.error.message} onRetry={() => void availability.refetch()} /> : (
          <SlotPicker slots={availability.data?.slots ?? []} selected={selectedAvailabilitySlots} onToggle={toggleSlot} />
        )}

        {court.data?.services?.length ? (
          <>
            <SectionHeader title="Dich vu di kem" />
            {court.data.services.map((service) => (
              <Card key={service.id}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.serviceName}>{service.name}</Text>
                    <Text style={styles.meta}>{service.description ?? "Dich vu cua san"}</Text>
                    <Text style={styles.price}>{formatCurrency(service.price)}</Text>
                  </View>
                  <QuantityStepper value={serviceQuantities[service.id] ?? 0} onChange={(quantity) => setServiceQuantities((current) => ({ ...current, [service.id]: quantity }))} />
                </View>
              </Card>
            ))}
          </>
        ) : null}

        <SectionHeader title="Voucher" />
        <Card>
          <FormInput label="Nhap ma voucher" value={voucherCodeInput} onChangeText={setVoucherCodeInput} autoCapitalize="characters" />
          <View style={styles.actions}>
            <Button variant="secondary" onPress={() => setVoucherCode(voucherCodeInput.trim() || undefined)}>Ap dung ma</Button>
            <Button variant="ghost" onPress={() => router.push({ pathname: "/vouchers/select", params: { courtId, date, slots: JSON.stringify(selectedSlots) } })}>Chon voucher cua toi</Button>
          </View>
          {params.voucherId ? <Text style={styles.meta}>Da chon voucher tu vi cua ban. Backend se validate lai khi quote.</Text> : null}
        </Card>

        <SectionHeader title="Thanh toan" />
        <View style={styles.actions}>
          <Chip label="Tra tai san" active={paymentType === "PAY_AT_COURT"} onPress={() => setPaymentType("PAY_AT_COURT")} />
          <Chip label="Coc QR" active={paymentType === "DEPOSIT"} onPress={() => setPaymentType("DEPOSIT")} />
          <Chip label="Tra het QR" active={paymentType === "FULL_PAYMENT"} onPress={() => setPaymentType("FULL_PAYMENT")} />
        </View>
        <FormInput label="Ghi chu cho san" value={note} onChangeText={setNote} multiline maxLength={500} />

        <SectionHeader title="Tom tat" />
        <Card>
          {quote.isLoading ? <LoadingState label="Dang tinh gia" /> : quote.isError ? <ErrorState message={quote.error.message} onRetry={() => void quote.refetch()} /> : quote.data ? (
            <>
              <SummaryRow label="Tien san" value={formatCurrency(quote.data.courtSubtotal)} />
              <SummaryRow label="Dich vu" value={formatCurrency(quote.data.servicesSubtotal)} />
              <SummaryRow label="Voucher" value={`-${formatCurrency(quote.data.voucherDiscountAmount)}`} />
              <SummaryRow label="Can thanh toan" value={formatCurrency(paymentType === "PAY_AT_COURT" ? 0 : paymentType === "DEPOSIT" ? quote.data.minimumDepositAmount : quote.data.totalAmount)} />
              <SummaryRow label="Tong don" value={formatCurrency(quote.data.totalAmount)} strong />
            </>
          ) : <Text style={styles.meta}>Chon slot de he thong tinh gia that.</Text>}
        </Card>
      </Screen>
      <StickyBottomAction>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.meta}>Tong don</Text>
            <Text style={styles.bottomPrice}>{quote.data ? formatCurrency(quote.data.totalAmount) : "-"}</Text>
          </View>
          <Button
            loading={checkout.isPending}
            disabled={!quote.data || checkout.isPending}
            onPress={() => checkout.mutate({ ...quotePayload, paymentType, note: note.trim() || undefined })}
          >
            Xac nhan
          </Button>
        </View>
      </StickyBottomAction>
    </View>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.rowBetween}>
      <Text style={styles.meta}>{label}</Text>
      <Text style={[styles.price, strong && styles.total]}>{value}</Text>
    </View>
  );
}

function parseSlots(value: string | string[] | undefined): BookingSlotPayload[] {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((item) => item?.startTime && item?.endTime).map((item) => ({ startTime: String(item.startTime), endTime: String(item.endTime) }));
  } catch {
    return [];
  }
  return [];
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  body: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 22
  },
  meta: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 19
  },
  serviceName: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: "900"
  },
  price: {
    color: colors.primaryDark,
    fontWeight: "900"
  },
  total: {
    fontSize: typography.h2,
    color: colors.ink
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  bottomPrice: {
    color: colors.ink,
    fontSize: typography.h2,
    fontWeight: "900"
  }
});

