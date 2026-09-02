import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { CalendarDays, MapPin, Star, TicketPercent, UsersRound, Clock } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { BlogPost, Booking, Court, MyVoucher, TeamRecruitmentPost, Tournament, Voucher } from "../api/types";
import { colors, radii, spacing, typography } from "../theme/tokens";
import { bookingStatusLabel, formatCurrency, formatDate, shortAddress, stripHtml, timeText } from "../utils/format";
import { StatusBadge } from "./Badges";

const fallbackImage = "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?q=80&w=600&auto=format&fit=crop";

export function CourtCard({ court, horizontal = false }: { court: Court; horizontal?: boolean }) {
  const router = useRouter();
  const image = court.images?.[0]?.imageUrl ?? fallbackImage;
  return (
    <Pressable onPress={() => router.push(`/courts/${court.id}`)} style={[styles.card, horizontal && styles.horizontalCard]}>
      <Image
        source={{ uri: image }}
        style={[styles.image, horizontal && styles.horizontalImage]}
        contentFit="cover"
        cachePolicy="memory-disk"
        priority="high"
        transition={100}
      />
      <View style={styles.cardBody}>
        <View style={styles.rowBetween}>
          <Text numberOfLines={1} style={styles.categoryBadge}>{court.category?.name ?? "Sân thể thao"}</Text>
          {court.distanceKm != null ? (
            <Text style={styles.distanceBadge}>{court.distanceKm.toFixed(1)} km</Text>
          ) : null}
        </View>
        <Text numberOfLines={1} style={styles.title}>{court.name}</Text>
        <View style={styles.inline}>
          <MapPin size={13} color={colors.muted} />
          <Text numberOfLines={1} style={styles.meta}>{shortAddress(court)}</Text>
        </View>
        <View style={styles.rowBetween}>
          <View style={styles.inline}>
            <Star size={13} color="#F59E0B" fill="#F59E0B" />
            <Text style={styles.strong}>{Number(court.averageRating ?? 0).toFixed(1)}</Text>
            <Text style={styles.meta}>({court.reviewCount ?? 0})</Text>
          </View>
          <Text style={styles.price}>Từ {formatCurrency(court.minPrice ?? minCourtPrice(court))}</Text>
        </View>
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
          <TicketPercent size={20} color={colors.primary} />
        </View>
        <StatusBadge status={state} kind="plain" />
      </View>
      <Text numberOfLines={1} style={styles.title}>{voucher.title}</Text>
      <Text style={styles.code}>{voucher.code}</Text>
      <Text numberOfLines={2} style={styles.meta}>{voucher.description ?? "Áp dụng cho lịch đặt sân hợp lệ."}</Text>
      <View style={styles.rowBetween}>
        <Text style={styles.price}>{voucher.discountType === "PERCENTAGE" ? `Giảm ${voucher.discountValue}%` : `Giảm ${formatCurrency(voucher.discountValue)}`}</Text>
        {onClaim ? (
          <Pressable disabled={loading || claimed} onPress={onClaim} style={[styles.smallButton, claimed && styles.smallButtonDisabled]}>
            <Text style={styles.smallButtonText}>{claimed ? "Đã nhận" : "Nhận mã"}</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

export function BookingCard({ booking }: { booking: Booking }) {
  const router = useRouter();
  const courtImage = booking.court?.images?.[0]?.imageUrl ?? fallbackImage;
  const address = shortAddress(booking.court);

  return (
    <Pressable onPress={() => router.push(`/bookings/${booking.id}`)} style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.code}>#{booking.bookingCode}</Text>
        <StatusBadge status={booking.bookingStatus} />
      </View>
      <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
        <Image source={{ uri: courtImage }} style={styles.bookingThumb} contentFit="cover" cachePolicy="memory-disk" />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={styles.title}>{booking.court?.name ?? "Sân đã đặt"}</Text>
          <Text numberOfLines={1} style={styles.meta}>{address}</Text>
          <Text style={styles.meta}>{formatDate(booking.bookingDate)} · {timeText(booking.startTime)} - {timeText(booking.endTime)}</Text>
        </View>
      </View>
      <View style={[styles.rowBetween, { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.xs }]}>
        <Text style={styles.meta}>{bookingStatusLabel(booking.bookingStatus)}</Text>
        <Text style={styles.price}>{formatCurrency(booking.totalPrice)}</Text>
      </View>
    </Pressable>
  );
}

export function TeammateCard({ post }: { post: TeamRecruitmentPost }) {
  const router = useRouter();
  const dateStr = post.playingDate ? formatDate(post.playingDate) : "Linh hoạt";
  const timeStr = `${(post.startTime || "").slice(0, 5)} - ${(post.endTime || "").slice(0, 5)}`;

  return (
    <Pressable onPress={() => router.push(`/teammates/${post.id}`)} style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.categoryBadge}>{post.sportType}</Text>
        <View style={styles.inline}>
          <UsersRound size={13} color={colors.primary} />
          <Text style={styles.strong}>{post.currentPlayers}/{post.maxPlayers} người</Text>
        </View>
      </View>
      <Text numberOfLines={2} style={styles.title}>{post.title}</Text>
      <View style={styles.inline}>
        <MapPin size={13} color={colors.muted} />
        <Text numberOfLines={1} style={styles.meta}>{post.courtName} - {post.address}</Text>
      </View>
      <View style={styles.inline}>
        <Clock size={13} color={colors.muted} />
        <Text style={styles.meta}>{dateStr} · {timeStr}</Text>
      </View>
      <View style={[styles.rowBetween, { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.xs }]}>
        <Text style={styles.meta}>Chủ nhóm: {post.createdBy?.fullName || "Ẩn danh"}</Text>
        <Text style={styles.price}>{post.pricePerPerson > 0 ? `${formatCurrency(post.pricePerPerson)}/người` : "Miễn phí"}</Text>
      </View>
    </Pressable>
  );
}

export function BlogCard({ post }: { post: BlogPost }) {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push(`/blogs/${post.slug}`)} style={styles.card}>
      <Image
        source={{ uri: post.coverImageUrl ?? fallbackImage }}
        style={styles.image}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={100}
      />
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
      <Image
        source={{ uri: tournament.coverImageUrl ?? tournament.court?.imageUrl ?? fallbackImage }}
        style={styles.image}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={100}
      />
      <StatusBadge status={tournament.status} kind="plain" />
      <Text numberOfLines={2} style={styles.title}>{tournament.title}</Text>
      <View style={styles.inline}>
        <CalendarDays size={14} color={colors.muted} />
        <Text style={styles.meta}>{formatDate(tournament.startDate)} - {formatDate(tournament.endDate)}</Text>
      </View>
      <Text style={styles.meta}>{tournament.sportType} · {tournament.court?.name ?? "Địa điểm đang cập nhật"}</Text>
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
    width: 250,
    marginRight: spacing.md
  },
  image: {
    height: 130,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt
  },
  horizontalImage: {
    height: 115
  },
  bookingThumb: {
    width: 50,
    height: 50,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceAlt
  },
  cardBody: {
    gap: spacing.xs
  },
  categoryBadge: {
    fontSize: 10,
    fontWeight: "900",
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.sm,
    alignSelf: "flex-start",
    textTransform: "uppercase"
  },
  distanceBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted
  },
  title: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: "900",
    lineHeight: 20
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
    gap: 4
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  voucherIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  smallButton: {
    minHeight: 32,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
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
