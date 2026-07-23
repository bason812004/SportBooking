import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { CalendarDays, MapPin, Star, TicketPercent } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { BlogPost, Booking, Court, MyVoucher, Tournament, Voucher } from "../api/types";
import { colors, radii, spacing, typography } from "../theme/tokens";
import { bookingStatusLabel, formatCurrency, formatDate, shortAddress, stripHtml, timeText } from "../utils/format";
import { StatusBadge } from "./Badges";

const fallbackImage = "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?q=80&w=1200&auto=format&fit=crop";

export function CourtCard({ court, horizontal = false }: { court: Court; horizontal?: boolean }) {
  const router = useRouter();
  const image = court.images?.[0]?.imageUrl ?? fallbackImage;
  return (
    <Pressable onPress={() => router.push(`/courts/${court.id}`)} style={[styles.card, horizontal && styles.horizontalCard]}>
      <Image source={{ uri: image }} style={[styles.image, horizontal && styles.horizontalImage]} contentFit="cover" transition={160} />
      <View style={styles.cardBody}>
        <Text numberOfLines={2} style={styles.title}>{court.name}</Text>
        <Text numberOfLines={1} style={styles.meta}>{court.category?.name ?? "San the thao"}</Text>
        <View style={styles.inline}>
          <MapPin size={14} color={colors.muted} />
          <Text numberOfLines={1} style={styles.meta}>{shortAddress(court)}</Text>
        </View>
        <View style={styles.rowBetween}>
          <View style={styles.inline}>
            <Star size={14} color={colors.warning} fill={colors.warning} />
            <Text style={styles.strong}>{Number(court.averageRating ?? 0).toFixed(1)}</Text>
            <Text style={styles.meta}>({court.reviewCount ?? 0})</Text>
          </View>
          <Text style={styles.price}>Tu {formatCurrency(court.minPrice ?? minCourtPrice(court))}</Text>
        </View>
        {court.distanceKm != null ? <Text style={styles.meta}>{court.distanceKm.toFixed(1)} km tu ban</Text> : null}
      </View>
    </Pressable>
  );
}

export function VoucherCard({ voucher, claimed, onClaim, loading }: { voucher: Voucher | MyVoucher; claimed?: boolean; onClaim?: () => void; loading?: boolean }) {
  const router = useRouter();
  const isMyVoucher = "userVoucherId" in voucher;
  const state = isMyVoucher ? voucher.status : claimed ? "CLAIMED" : voucher.status;
  return (
    <Pressable onPress={() => router.push(`/vouchers/${voucher.id}`)} style={styles.card}>
      <View style={styles.rowBetween}>
        <View style={styles.voucherIcon}>
          <TicketPercent size={22} color={colors.primary} />
        </View>
        <StatusBadge status={state} kind="plain" />
      </View>
      <Text style={styles.title}>{voucher.title}</Text>
      <Text style={styles.code}>{voucher.code}</Text>
      <Text numberOfLines={2} style={styles.meta}>{voucher.description ?? "Ap dung cho lich dat san hop le."}</Text>
      <View style={styles.rowBetween}>
        <Text style={styles.price}>{voucher.discountType === "PERCENTAGE" ? `${voucher.discountValue}%` : formatCurrency(voucher.discountValue)}</Text>
        {onClaim ? (
          <Pressable disabled={loading || claimed} onPress={onClaim} style={[styles.smallButton, claimed && styles.smallButtonDisabled]}>
            <Text style={styles.smallButtonText}>{claimed ? "Da nhan" : "Nhan"}</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

export function BookingCard({ booking }: { booking: Booking }) {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push(`/bookings/${booking.id}`)} style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.code}>{booking.bookingCode}</Text>
        <StatusBadge status={booking.bookingStatus} />
      </View>
      <Text style={styles.title}>{booking.court?.name ?? "San da dat"}</Text>
      <Text style={styles.meta}>{formatDate(booking.bookingDate)} · {timeText(booking.startTime)} - {timeText(booking.endTime)}</Text>
      <View style={styles.rowBetween}>
        <Text style={styles.meta}>{bookingStatusLabel(booking.bookingStatus)}</Text>
        <Text style={styles.price}>{formatCurrency(booking.totalPrice)}</Text>
      </View>
    </Pressable>
  );
}

export function BlogCard({ post }: { post: BlogPost }) {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push(`/blogs/${post.slug}`)} style={styles.card}>
      <Image source={{ uri: post.coverImageUrl ?? fallbackImage }} style={styles.image} contentFit="cover" />
      <Text numberOfLines={2} style={styles.title}>{post.title}</Text>
      <Text numberOfLines={2} style={styles.meta}>{post.excerpt ?? stripHtml(post.content)}</Text>
      <Text style={styles.meta}>{formatDate(post.publishedAt ?? post.createdAt)}</Text>
    </Pressable>
  );
}

export function TournamentCard({ tournament }: { tournament: Tournament }) {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push(`/tournaments/${tournament.slug}`)} style={styles.card}>
      <Image source={{ uri: tournament.coverImageUrl ?? tournament.court?.imageUrl ?? fallbackImage }} style={styles.image} contentFit="cover" />
      <StatusBadge status={tournament.status} kind="plain" />
      <Text numberOfLines={2} style={styles.title}>{tournament.title}</Text>
      <View style={styles.inline}>
        <CalendarDays size={14} color={colors.muted} />
        <Text style={styles.meta}>{formatDate(tournament.startDate)} - {formatDate(tournament.endDate)}</Text>
      </View>
      <Text style={styles.meta}>{tournament.sportType} · {tournament.court?.name ?? "Dia diem dang cap nhat"}</Text>
    </Pressable>
  );
}

function minCourtPrice(court: Court) {
  const prices = court.prices?.map((item) => Number(item.price)).filter(Number.isFinite) ?? [];
  return prices.length ? Math.min(...prices) : 0;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm
  },
  horizontalCard: {
    width: 260,
    marginRight: spacing.md
  },
  image: {
    height: 140,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt
  },
  horizontalImage: {
    height: 116
  },
  cardBody: {
    gap: spacing.xs
  },
  title: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: "900",
    lineHeight: 21
  },
  meta: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18
  },
  strong: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: "900"
  },
  price: {
    color: colors.primaryDark,
    fontSize: typography.small,
    fontWeight: "900"
  },
  code: {
    color: colors.action,
    fontSize: typography.small,
    fontWeight: "900",
    letterSpacing: 0.4
  },
  inline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  voucherIcon: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  smallButton: {
    minHeight: 36,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  smallButtonDisabled: {
    backgroundColor: colors.surfaceAlt
  },
  smallButtonText: {
    color: colors.surface,
    fontSize: typography.small,
    fontWeight: "900"
  }
});

