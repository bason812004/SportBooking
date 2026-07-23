import * as Location from "expo-location";
import { Link, useRouter } from "expo-router";
import { Bell, MapPin } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { courtApi } from "../../src/api/courts";
import { contentApi } from "../../src/api/content";
import { queryKeys } from "../../src/api/queryKeys";
import { voucherApi } from "../../src/api/vouchers";
import { Button, Chip } from "../../src/components/Buttons";
import { BlogCard, CourtCard, TournamentCard, VoucherCard } from "../../src/components/Cards";
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

  const categories = useQuery({ queryKey: queryKeys.categories, queryFn: courtApi.categories });
  const courts = useQuery({
    queryKey: queryKeys.courts({ home: true, location }),
    queryFn: () => courtApi.list({ limit: 8, latitude: location?.latitude, longitude: location?.longitude, sortBy: location ? "distance" : "newest" })
  });
  const vouchers = useQuery({ queryKey: queryKeys.vouchers, queryFn: voucherApi.list });
  const myVouchers = useQuery({ queryKey: queryKeys.myVouchers, queryFn: voucherApi.myVouchers, enabled: Boolean(user) });
  const blogs = useQuery({ queryKey: queryKeys.blogs({ home: true }), queryFn: () => contentApi.blogs() });
  const tournaments = useQuery({ queryKey: queryKeys.tournaments, queryFn: contentApi.tournaments });

  const claim = useMutation({
    mutationFn: voucherApi.claim,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.vouchers }),
        queryClient.invalidateQueries({ queryKey: queryKeys.myVouchers })
      ]);
      Alert.alert("Da nhan voucher", "Voucher da duoc luu vao vi cua ban.");
    },
    onError: (error) => Alert.alert("Khong nhan duoc voucher", error instanceof Error ? error.message : "Vui long thu lai")
  });

  async function requestLocation() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert("Chua co quyen vi tri", "Ban van co the tim san theo quan, thanh pho.");
      return;
    }
    const current = await Location.getCurrentPositionAsync({});
    setLocation({ latitude: current.coords.latitude, longitude: current.coords.longitude });
  }

  const claimedIds = new Set(myVouchers.data?.map((item) => item.id));

  return (
    <Screen
      title={user ? `Chao ${user.fullName}` : "SportBooking"}
      subtitle={user ? "San sang cho tran dau tiep theo." : "Tim san, xem lich trong va dat san nhanh."}
      refreshing={courts.isRefetching}
      onRefresh={() => void courts.refetch()}
      right={
        user ? (
          <Pressable accessibilityLabel="Thong bao" onPress={() => router.push("/notifications")} style={styles.iconButton}>
            <Bell size={21} color={colors.ink} />
          </Pressable>
        ) : (
          <Button variant="secondary" onPress={() => router.push("/auth/login")}>Dang nhap</Button>
        )
      }
    >
      <Pressable onPress={() => router.push({ pathname: "/(tabs)/courts", params: { q: search } })}>
        <SearchInput value={search} onChangeText={setSearch} />
      </Pressable>

      <Card style={styles.locationCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.locationTitle}>San gan ban</Text>
          <Text style={styles.locationText}>{location ? "Dang sap xep theo vi tri hien tai" : "Bat vi tri de xem san gan nhat"}</Text>
        </View>
        <Button variant="secondary" onPress={requestLocation}>Vi tri</Button>
      </Card>

      <SectionHeader title="Bo mon" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal}>
        {(categories.data ?? []).map((category) => (
          <Chip key={category.id} label={category.name} onPress={() => router.push({ pathname: "/(tabs)/courts", params: { categoryId: category.id } })} />
        ))}
      </ScrollView>

      <SectionHeader title={location ? "Gan ban" : "San moi"} action={<Link href="/(tabs)/courts" style={styles.link}>Xem tat ca</Link>} />
      {courts.isLoading ? <SkeletonCard /> : courts.isError ? <ErrorState message={courts.error.message} onRetry={() => void courts.refetch()} /> : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal}>
          {courts.data?.items.map((court) => <CourtCard key={court.id} court={court} horizontal />)}
        </ScrollView>
      )}

      <SectionHeader title="Voucher noi bat" action={<Link href="/(tabs)/vouchers" style={styles.link}>Xem tat ca</Link>} />
      {vouchers.data?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal}>
          {vouchers.data.slice(0, 8).map((voucher) => (
            <View key={voucher.id} style={{ width: 260, marginRight: spacing.md }}>
              <VoucherCard
                voucher={voucher}
                claimed={claimedIds.has(voucher.id)}
                loading={claim.isPending}
                onClaim={() => user ? claim.mutate(voucher.id) : router.push({ pathname: "/auth/login", params: { returnTo: "/(tabs)/vouchers" } })}
              />
            </View>
          ))}
        </ScrollView>
      ) : <EmptyState title="Chua co voucher" message="Voucher dang duoc cap nhat." />}

      <SectionHeader title="Giai dau sap dien ra" action={<Link href="/tournaments" style={styles.link}>Xem tat ca</Link>} />
      {(tournaments.data ?? []).slice(0, 3).map((item) => <TournamentCard key={item.id} tournament={item} />)}

      <SectionHeader title="Bai viet moi" action={<Link href="/blogs" style={styles.link}>Xem tat ca</Link>} />
      {(blogs.data ?? []).slice(0, 3).map((post) => <BlogCard key={post.id} post={post} />)}
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  horizontal: {
    gap: spacing.md,
    paddingRight: spacing.lg
  },
  link: {
    color: colors.primary,
    fontWeight: "900"
  },
  locationCard: {
    flexDirection: "row",
    alignItems: "center"
  },
  locationTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: "900"
  },
  locationText: {
    color: colors.muted,
    fontSize: typography.small,
    marginTop: 4
  }
});

