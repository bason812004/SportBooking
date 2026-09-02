import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState, useEffect } from "react";
import { Alert, StyleSheet, Text, View, ScrollView, TouchableOpacity } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bookingApi } from "../../src/api/bookings";
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
import { useBookingStore, getSlotKey } from "../../src/store/useBookingStore";
import { useLanguageStore } from "../../src/i18n";
import { colors, spacing, typography } from "../../src/theme/tokens";
import { formatCurrency, shortAddress, todayKey, formatDate } from "../../src/utils/format";
import { Trash2 } from "lucide-react-native";

export default function BookingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const { t } = useLanguageStore();
  const params = useLocalSearchParams<{ courtId: string; date?: string }>();
  const courtId = Array.isArray(params.courtId) ? params.courtId[0] : params.courtId;
  
  const [date, setDate] = useState(params.date ?? todayKey());
  const [serviceQuantities, setServiceQuantities] = useState<Record<string, number>>({});
  const [voucherCodeInput, setVoucherCodeInput] = useState("");
  const [voucherCode, setVoucherCode] = useState<string | undefined>(undefined);

  const {
    selectedSlots,
    paymentType,
    note,
    setCourtId,
    toggleSlot,
    removeSlot,
    clearSlots,
    setPaymentType,
    setNote
  } = useBookingStore();

  useEffect(() => {
    if (courtId) setCourtId(courtId);
  }, [courtId, setCourtId]);

  const court = useQuery({
    queryKey: queryKeys.court(courtId),
    queryFn: () => courtApi.detail(courtId),
    enabled: Boolean(courtId),
    staleTime: 2 * 60 * 1000
  });

  const availability = useQuery({
    queryKey: queryKeys.courtAvailability(courtId, date),
    queryFn: () => courtApi.availability(courtId, date),
    enabled: Boolean(courtId),
    staleTime: 30 * 1000
  });

  const services = useMemo(
    () => Object.entries(serviceQuantities).filter(([, quantity]) => quantity > 0).map(([serviceId, quantity]) => ({ serviceId, quantity })),
    [serviceQuantities]
  );

  const earliestDate = useMemo(() => {
    if (!selectedSlots.length) return date;
    const sorted = [...selectedSlots].sort((a, b) => a.date.localeCompare(b.date));
    return sorted[0].date;
  }, [selectedSlots, date]);

  const slotsPayload = useMemo(
    () => selectedSlots.map((s) => ({ date: s.date, startTime: s.startTime, endTime: s.endTime })),
    [selectedSlots]
  );

  const quotePayload = useMemo(
    () => ({
      courtId,
      bookingDate: earliestDate,
      slots: slotsPayload,
      services,
      voucherCode
    }),
    [courtId, earliestDate, slotsPayload, services, voucherCode]
  );

  const quote = useQuery({
    queryKey: ["booking-quote", quotePayload],
    queryFn: () => bookingApi.quote(quotePayload),
    enabled: Boolean(user && courtId && selectedSlots.length > 0),
    staleTime: 10 * 1000
  });

  const checkout = useMutation({
    mutationFn: bookingApi.checkout,
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.bookings }),
        queryClient.invalidateQueries({ queryKey: queryKeys.courtAvailability(courtId, date) })
      ]);
      clearSlots();
      if (result.paymentId) {
        router.replace(`/payment/${result.paymentId}`);
      } else {
        router.replace(`/bookings/${result.bookingId}`);
      }
    },
    onError: (error) => Alert.alert(t.common.error, error instanceof Error ? error.message : t.common.error)
  });

  if (!user) {
    return (
      <Screen title={t.auth.loginTitle} subtitle="Vui lòng đăng nhập để tiếp tục đặt sân." back>
        <Card>
          <Text style={styles.body}>Bạn cần đăng nhập tài khoản Khách hàng để thực hiện đặt sân.</Text>
          <Button onPress={() => router.push({ pathname: "/auth/login", params: { returnTo: `/booking/${courtId}` } })}>
            {t.auth.loginButton}
          </Button>
        </Card>
      </Screen>
    );
  }

  const handleToggleSlot = (slot: AvailabilitySlot) => {
    toggleSlot({
      courtId,
      date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      price: slot.price ?? 0,
      courtName: court.data?.name
    });
  };

  const currentDaySelectedKeys = useMemo(
    () => new Set(selectedSlots.filter((s) => s.date === date).map((s) => `${s.startTime}-${s.endTime}`)),
    [selectedSlots, date]
  );

  const selectedAvailabilitySlots = selectedSlots
    .filter((s) => s.date === date)
    .map((s) => ({ startTime: s.startTime, endTime: s.endTime, status: "AVAILABLE" as const, price: s.price, bookingId: null }));

  return (
    <View style={{ flex: 1 }}>
      <Screen title={t.courts.selectSchedule} subtitle={court.data ? `${court.data.name} · ${shortAddress(court.data)}` : ""} back>
        {court.isLoading ? <LoadingState /> : court.isError ? <ErrorState message={court.error.message} onRetry={() => void court.refetch()} /> : null}

        <SectionHeader title="Chọn ngày chơi" />
        <DateStrip value={date} onChange={(nextDate) => setDate(nextDate)} />

        <SectionHeader title={`Lịch sân ngày ${formatDate(date)}`} />
        {availability.isLoading ? (
          <LoadingState label="Đang tải lịch sân..." />
        ) : availability.isError ? (
          <ErrorState message={availability.error.message} onRetry={() => void availability.refetch()} />
        ) : (
          <SlotPicker
            slots={availability.data?.slots ?? []}
            selected={selectedAvailabilitySlots}
            onToggle={handleToggleSlot}
          />
        )}

        {selectedSlots.length > 0 && (
          <>
            <SectionHeader title={`${t.booking.selectedSlots} (${selectedSlots.length})`} />
            <Card style={{ gap: 8 }}>
              {selectedSlots.map((s) => {
                const key = getSlotKey(s);
                return (
                  <View key={key} style={styles.selectedSlotRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "800", color: colors.ink, fontSize: typography.body }}>
                        {formatDate(s.date)} · {s.startTime} - {s.endTime}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => removeSlot(key)} style={{ padding: 4 }}>
                      <Trash2 size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </Card>
          </>
        )}

        {court.data?.services?.length ? (
          <>
            <SectionHeader title="Dịch vụ đi kèm" />
            {court.data.services.map((service) => (
              <Card key={service.id}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.serviceName}>{service.name}</Text>
                    <Text style={styles.meta}>{service.description ?? ""}</Text>
                    <Text style={styles.price}>{formatCurrency(service.price)}</Text>
                  </View>
                  <QuantityStepper
                    value={serviceQuantities[service.id] ?? 0}
                    onChange={(quantity) => setServiceQuantities((current) => ({ ...current, [service.id]: quantity }))}
                  />
                </View>
              </Card>
            ))}
          </>
        ) : null}

        <SectionHeader title="Voucher ưu đãi" />
        <Card style={{ gap: 10 }}>
          <FormInput
            label="Nhập mã Voucher"
            value={voucherCodeInput}
            onChangeText={setVoucherCodeInput}
            autoCapitalize="characters"
          />
          <View style={styles.actions}>
            <Button variant="secondary" onPress={() => setVoucherCode(voucherCodeInput.trim() || undefined)}>
              {t.common.apply}
            </Button>
          </View>
        </Card>

        <SectionHeader title={t.booking.paymentMethod} />
        <View style={styles.actions}>
          <Chip label={t.booking.payAtCourt} active={paymentType === "PAY_AT_COURT"} onPress={() => setPaymentType("PAY_AT_COURT")} />
          <Chip label={t.booking.depositPayment} active={paymentType === "DEPOSIT"} onPress={() => setPaymentType("DEPOSIT")} />
          <Chip label={t.booking.fullPayment} active={paymentType === "FULL_PAYMENT"} onPress={() => setPaymentType("FULL_PAYMENT")} />
        </View>
        <FormInput label={t.booking.notePlaceholder} value={note} onChangeText={setNote} multiline maxLength={500} />

        <SectionHeader title={t.booking.summaryTitle} />
        <Card style={{ gap: 8 }}>
          {quote.isLoading ? (
            <LoadingState label="Đang tính toán tổng chi phí..." />
          ) : quote.isError ? (
            <ErrorState message={quote.error.message} onRetry={() => void quote.refetch()} />
          ) : quote.data ? (
            <>
              <SummaryRow label={t.booking.basePrice} value={formatCurrency(quote.data.courtSubtotal)} />
              <SummaryRow label="Dịch vụ đi kèm" value={formatCurrency(quote.data.servicesSubtotal)} />
              <SummaryRow label={t.booking.voucherDiscount} value={`-${formatCurrency(quote.data.voucherDiscountAmount)}`} />
              <SummaryRow
                label={t.booking.totalAmount}
                value={formatCurrency(paymentType === "PAY_AT_COURT" ? 0 : paymentType === "DEPOSIT" ? quote.data.minimumDepositAmount : quote.data.totalAmount)}
                strong
              />
            </>
          ) : (
            <Text style={styles.meta}>Vui lòng chọn ít nhất 1 ô giờ để xem tổng giá.</Text>
          )}
        </Card>
      </Screen>

      <StickyBottomAction>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.meta}>{t.booking.totalAmount}</Text>
            <Text style={styles.bottomPrice}>{quote.data ? formatCurrency(quote.data.totalAmount) : "-"}</Text>
          </View>
          <Button
            loading={checkout.isPending}
            disabled={!quote.data || checkout.isPending}
            onPress={() => checkout.mutate({ ...quotePayload, paymentType, note: note.trim() || undefined })}
          >
            {t.booking.confirmBooking}
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

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  body: {
    color: colors.ink,
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
  },
  selectedSlotRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f0fdf4",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0"
  }
});
