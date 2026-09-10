import * as Location from "expo-location";
import { Link, useRouter } from "expo-router";
import { Bell, Compass, Gift, Trophy, Users } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { courtApi } from "../../src/api/courts";
import { contentApi } from "../../src/api/content";
import { queryKeys } from "../../src/api/queryKeys";
import { voucherApi } from "../../src/api/vouchers";
import { Button, Chip } from "../../src/components/Buttons";
import { BlogCard, CourtCard, TeammateCard, TournamentCard, VoucherCard } from "../../src/components/Cards";
import { SearchInput } from "../../src/components/Forms";
import { Card, Screen, SectionHeader } from "../../src/components/Screen";
import { EmptyState, ErrorState, SkeletonCard } from "../../src/components/StateViews";
import { useAuthStore } from "../../src/store/auth";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";

export default function HomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Cached for 10 minutes
  const categories = useQuery({
    queryKey: queryKeys.categories,
    queryFn: courtApi.categories,
    staleTime: 10 * 60 * 1000
  });

  // Cached for 1 minute
  const courts = useQuery({
    queryKey: queryKeys.courts({ home: true, location }),
    queryFn: () =>
      courtApi.list({
        limit: 6,
        latitude: location?.latitude,
        longitude: location?.longitude,
        sortBy: location ? "distance" : "newest"
      }),
    staleTime: 60 * 1000
  });

  const vouchers = useQuery({
    queryKey: queryKeys.vouchers,
    queryFn: voucherApi.list,
    staleTime: 2 * 60 * 1000
  });

  const myVouchers = useQuery({
    queryKey: queryKeys.myVouchers,
    queryFn: voucherApi.myVouchers,
    enabled: Boolean(user),
    staleTime: 60 * 1000
  });

  const teamPosts = useQuery({
    queryKey: queryKeys.teamPosts(),
    queryFn: contentApi.teamPosts,
    staleTime: 60 * 1000
  });

  const tournaments = useQuery({
    queryKey: queryKeys.tournaments,
    queryFn: contentApi.tournaments,
    staleTime: 5 * 60 * 1000
  });

  const blogs = useQuery({
    queryKey: queryKeys.blogs({ home: true }),
    queryFn: () => contentApi.blogs(),
    staleTime: 5 * 60 * 1000
  });

  const claim = useMutation({
    mutationFn: voucherApi.claim,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.vouchers }),
        queryClient.invalidateQueries({ queryKey: queryKeys.myVouchers })
      ]);
      Alert.alert("Thành công", "Voucher đã được lưu vào ví của bạn.");
    },
    onError: (error) => Alert.alert("Không thể nhận", error instanceof Error ? error.message : "Vui lòng thử lại sau.")
  });

  async function requestLocation() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert("Chưa cấp quyền vị trí", "Bạn vẫn có thể tìm kiếm sân theo quận, thành phố.");
      return;
    }
    const current = await Location.getCurrentPositionAsync({});
    setLocation({ latitude: current.coords.latitude, longitude: current.coords.longitude });
  }

  const claimedIds = new Set(myVouchers.data?.map((item) => item.id));

  return (
    <Screen
      title={user ? `Chào ${user.fullName} 👋` : "SportBooking"}
      subtitle={user ? "Sẵn sàng cho trận đấu tiếp theo!" : "Đặt sân thể thao dễ dàng & tiện lợi."}
      refreshing={courts.isRefetching}
      onRefresh={() => void courts.refetch()}
      right={
        user ? (
          <Pressable accessibilityLabel="Thông báo" onPress={() => router.push("/notifications")} style={styles.iconButton}>
            <Bell size={21} color={colors.ink} />
          </Pressable>
        ) : (
          <Button variant="secondary" onPress={() => router.push("/auth/login")}>Đăng nhập</Button>
        )
      }
    >
      {/* Quick Search */}
      <Pressable onPress={() => router.push({ pathname: "/(tabs)/courts", params: { q: search } })}>
        <SearchInput value={search} onChangeText={setSearch} placeholder="Tìm sân, địa điểm, môn thể thao..." />
      </Pressable>

      {/* Quick Action Grid */}
      <View style={styles.quickActions}>
        <QuickActionItem
          icon={Compass}
          label="Tìm sân"
          color="#059669"
          bgColor="#ECFDF5"
          onPress={() => router.push("/(tabs)/courts")}
        />
        <QuickActionItem
          icon={Users}
          label="Ghép đội"
          color="#2563EB"
          bgColor="#EFF6FF"
          onPress={() => router.push("/(tabs)/teammates")}
        />
        <QuickActionItem
          icon={Gift}
          label="Voucher"
          color="#D97706"
          bgColor="#FFFBEB"
          onPress={() => router.push("/vouchers")}
        />
        <QuickActionItem
          icon={Trophy}
          label="Giải đấu"
          color="#7C3AED"
          bgColor="#F5F3FF"
          onPress={() => router.push("/tournaments")}
        />
      </View>

      {/* Location Banner */}
      <Card style={styles.locationCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.locationTitle}>Sân thể thao gần bạn</Text>
          <Text style={styles.locationText}>{location ? "Đang sắp xếp theo vị trí hiện tại của bạn" : "Bật định vị để xem các sân gần nhất"}</Text>
        </View>
        <Button variant={location ? "secondary" : "primary"} onPress={requestLocation}>
          {location ? "Đã bật" : "Bật vị trí"}
        </Button>
      </Card>

      {/* Sport Category Pills */}
      <SectionHeader title="Môn thể thao" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal}>
        {(categories.data ?? []).map((category) => (
          <Chip
            key={category.id}
            label={category.name}
            onPress={() => router.push({ pathname: "/(tabs)/courts", params: { categoryId: category.id } })}
          />
        ))}
      </ScrollView>

      {/* Featured / Nearby Courts */}
      <SectionHeader
        title={location ? "Sân gần bạn nhất" : "Sân nổi bật"}
        action={<Link href="/(tabs)/courts" style={styles.link}>Xem tất cả</Link>}
      />
      {courts.isLoading ? (
        <SkeletonCard />
      ) : courts.isError ? (
        <ErrorState message={courts.error.message} onRetry={() => void courts.refetch()} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal}>
          {courts.data?.items.map((court) => <CourtCard key={court.id} court={court} horizontal />)}
        </ScrollView>
      )}

      {/* Teammates Recruitment Posts */}
      <SectionHeader
        title="Tìm bạn thi đấu & Ghép đội"
        action={<Link href="/(tabs)/teammates" style={styles.link}>Xem tất cả</Link>}
      />
      {teamPosts.isLoading ? (
        <SkeletonCard />
      ) : teamPosts.data?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal}>
          {teamPosts.data.slice(0, 5).map((post) => (
            <View key={post.id} style={{ width: 260, marginRight: spacing.md }}>
              <TeammateCard post={post} />
            </View>
          ))}
        </ScrollView>
      ) : (
        <EmptyState title="Chưa có bài đăng" message="Hãy tạo bài đăng tìm bạn chơi thể thao ngay!" />
      )}

      {/* Vouchers Section */}
      <SectionHeader
        title="Voucher & Khuyến mãi"
        action={<Link href="/vouchers" style={styles.link}>Xem tất cả</Link>}
      />
      {vouchers.data?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal}>
          {vouchers.data.slice(0, 6).map((voucher) => (
            <View key={voucher.id} style={{ width: 260, marginRight: spacing.md }}>
              <VoucherCard
                voucher={voucher}
                claimed={claimedIds.has(voucher.id)}
                loading={claim.isPending}
                onClaim={() => (user ? claim.mutate(voucher.id) : router.push({ pathname: "/auth/login", params: { returnTo: "/vouchers" } }))}
              />
            </View>
          ))}
        </ScrollView>
      ) : (
        <EmptyState title="Chưa có voucher" message="Ưu đãi đang được cập nhật." />
      )}

      {/* Tournaments */}
      <SectionHeader
        title="Giải đấu sắp diễn ra"
        action={<Link href="/tournaments" style={styles.link}>Xem tất cả</Link>}
      />
      {(tournaments.data ?? []).slice(0, 3).map((item) => (
        <TournamentCard key={item.id} tournament={item} />
      ))}

      {/* Blogs */}
      <SectionHeader
        title="Tin tức & Kinh nghiệm"
        action={<Link href="/blogs" style={styles.link}>Xem tất cả</Link>}
      />
      {(blogs.data ?? []).slice(0, 3).map((post) => (
        <BlogCard key={post.id} post={post} />
      ))}
    </Screen>
  );
}

function QuickActionItem({
  icon: Icon,
  label,
  color,
  bgColor,
  onPress
}: {
  icon: any;
  label: string;
  color: string;
  bgColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.quickActionItem}>
      <View style={[styles.quickActionIcon, { backgroundColor: bgColor }]}>
        <Icon size={22} color={color} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: spacing.xs
  },
  quickActionItem: {
    alignItems: "center",
    gap: 6,
    flex: 1
  },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.ink
  },
  horizontal: {
    gap: spacing.md,
    paddingRight: spacing.lg
  },
  link: {
    color: colors.primary,
    fontWeight: "900",
    fontSize: typography.small
  },
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  locationTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: "900"
  },
  locationText: {
    color: colors.muted,
    fontSize: typography.small,
    marginTop: 2
  }
});
