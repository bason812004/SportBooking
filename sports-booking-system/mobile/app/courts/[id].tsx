import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MapPin, Star } from "lucide-react-native";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { courtApi } from "../../src/api/courts";
import type { AvailabilitySlot } from "../../src/api/types";
import { queryKeys } from "../../src/api/queryKeys";
import { Button } from "../../src/components/Buttons";
import { CourtCard } from "../../src/components/Cards";
import { Card, Screen, SectionHeader } from "../../src/components/Screen";
import { DateStrip, SlotPicker } from "../../src/components/SlotPicker";
import { ErrorState, LoadingState } from "../../src/components/StateViews";
import { StickyBottomAction } from "../../src/components/StickyBottomAction";
import { colors, spacing, typography } from "../../src/theme/tokens";
import { formatCurrency, shortAddress, stripHtml, timeText, todayKey } from "../../src/utils/format";

const fallbackImage = "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?q=80&w=1400&auto=format&fit=crop";

export default function CourtDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const courtId = Array.isArray(id) ? id[0] : id;
  const [date, setDate] = useState(todayKey());
  const [selectedSlots, setSelectedSlots] = useState<AvailabilitySlot[]>([]);
  const court = useQuery({ queryKey: queryKeys.court(courtId), queryFn: () => courtApi.detail(courtId), enabled: Boolean(courtId) });
  const availability = useQuery({ queryKey: queryKeys.courtAvailability(courtId, date), queryFn: () => courtApi.availability(courtId, date), enabled: Boolean(courtId) });

  function toggleSlot(slot: AvailabilitySlot) {
    setSelectedSlots((current) => {
      const exists = current.some((item) => item.startTime === slot.startTime && item.endTime === slot.endTime);
      return exists ? current.filter((item) => item.startTime !== slot.startTime || item.endTime !== slot.endTime) : [...current, slot].sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
  }

  if (court.isLoading) return <Screen back><LoadingState /></Screen>;
  if (court.isError) return <Screen back><ErrorState message={court.error.message} onRetry={() => void court.refetch()} /></Screen>;
  if (!court.data) return <Screen back><ErrorState message="Khong tim thay san" /></Screen>;

  const data = court.data;
  const image = data.images?.[0]?.imageUrl ?? fallbackImage;
  const priceValues = (data.prices ?? []).map((item) => Number(item.price)).filter(Number.isFinite);
  const minPrice = data.minPrice ?? (priceValues.length ? Math.min(...priceValues) : 0);
  const canBook = data.activeStatus === "ACTIVE";

  return (
    <View style={{ flex: 1 }}>
      <Screen title={data.name} subtitle={shortAddress(data)} back>
        <Image source={{ uri: image }} style={styles.hero} contentFit="cover" />
        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.category}>{data.category?.name ?? "San the thao"}</Text>
            <View style={styles.inline}>
              <Star size={16} color={colors.warning} fill={colors.warning} />
              <Text style={styles.strong}>{Number(data.averageRating ?? 0).toFixed(1)}</Text>
              <Text style={styles.meta}>({data.reviewCount ?? 0})</Text>
            </View>
          </View>
          <View style={styles.inline}>
            <MapPin size={16} color={colors.muted} />
            <Text style={styles.meta}>{shortAddress(data)}</Text>
          </View>
          <Text style={styles.meta}>Gio mo cua: {timeText(data.openingTime)} - {timeText(data.closingTime)}</Text>
          <View style={styles.actions}>
            {data.contactPhone ? <Button variant="secondary" onPress={() => Linking.openURL(`tel:${data.contactPhone}`)}>Goi san</Button> : null}
            <Button variant="secondary" onPress={() => Linking.openURL(data.mapUrl || `https://maps.google.com/?q=${encodeURIComponent(shortAddress(data))}`)}>Mo ban do</Button>
            <Button variant="ghost" onPress={() => Linking.openURL(`sportbooking://courts/${data.id}`)}>Chia se</Button>
          </View>
        </Card>

        <SectionHeader title="Mo ta" />
        <Card>
          <Text style={styles.body}>{stripHtml(data.description) || "San chua cap nhat mo ta chi tiet."}</Text>
        </Card>

        <SectionHeader title="Tien ich" />
        <Card>
          <View style={styles.wrap}>
            {(data.amenities ?? []).length ? data.amenities.map((item) => <Text key={item.id} style={styles.pill}>{item.name}</Text>) : <Text style={styles.meta}>Chua co tien ich duoc cong bo.</Text>}
          </View>
        </Card>

        <SectionHeader title="Bang gia" />
        <Card>
          {(data.prices ?? []).map((price) => (
            <View key={price.id} style={styles.rowBetween}>
              <Text style={styles.meta}>{price.dayType} · {timeText(price.startTime)} - {timeText(price.endTime)}</Text>
              <Text style={styles.strong}>{formatCurrency(price.price)}</Text>
            </View>
          ))}
        </Card>

        <SectionHeader title="Kiem tra lich trong" />
        <DateStrip value={date} onChange={(nextDate) => { setDate(nextDate); setSelectedSlots([]); }} />
        {availability.isLoading ? <LoadingState label="Dang tai lich san" /> : availability.isError ? <ErrorState message={availability.error.message} onRetry={() => void availability.refetch()} /> : (
          <SlotPicker slots={availability.data?.slots ?? []} selected={selectedSlots} onToggle={toggleSlot} />
        )}

        {data.reviews?.length ? (
          <>
            <SectionHeader title="Danh gia" />
            {data.reviews.slice(0, 5).map((review) => (
              <Card key={review.id}>
                <View style={styles.inline}>
                  <Star size={15} color={colors.warning} fill={colors.warning} />
                  <Text style={styles.strong}>{review.rating}/5</Text>
                  <Text style={styles.meta}>{review.user.fullName}</Text>
                </View>
                <Text style={styles.body}>{review.comment ?? "Khong co noi dung"}</Text>
              </Card>
            ))}
          </>
        ) : null}

        {data.nearbyCourts?.length ? (
          <>
            <SectionHeader title="San lan can" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.lg }}>
              {data.nearbyCourts.map((item) => <CourtCard key={item.id} court={item} horizontal />)}
            </ScrollView>
          </>
        ) : null}
      </Screen>

      <StickyBottomAction>
        <View style={styles.bottom}>
          <View>
            <Text style={styles.meta}>Gia tu</Text>
            <Text style={styles.bottomPrice}>{formatCurrency(minPrice)}</Text>
          </View>
          <Button
            disabled={!canBook || selectedSlots.length === 0}
            onPress={() => {
              if (!selectedSlots.length) {
                Alert.alert("Chon khung gio", "Hay chon it nhat mot slot con trong.");
                return;
              }
              router.push({ pathname: "/booking/[courtId]", params: { courtId: data.id, date, slots: JSON.stringify(selectedSlots.map(({ startTime, endTime }) => ({ startTime, endTime }))) } });
            }}
          >
            Dat san
          </Button>
        </View>
      </StickyBottomAction>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: 250,
    borderRadius: 22,
    backgroundColor: colors.surfaceAlt
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md
  },
  inline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  category: {
    color: colors.primary,
    fontWeight: "900",
    fontSize: typography.body
  },
  strong: {
    color: colors.ink,
    fontWeight: "900"
  },
  meta: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 19
  },
  body: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 22
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  pill: {
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    color: colors.primaryDark,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    fontWeight: "800"
  },
  bottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  bottomPrice: {
    color: colors.ink,
    fontSize: typography.h2,
    fontWeight: "900"
  }
});
