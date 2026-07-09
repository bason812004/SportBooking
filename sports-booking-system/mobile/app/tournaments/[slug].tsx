import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { contentApi } from "../../src/api/content";
import { queryKeys } from "../../src/api/queryKeys";
import { Button } from "../../src/components/Buttons";
import { StatusBadge } from "../../src/components/Badges";
import { Card, Screen } from "../../src/components/Screen";
import { ErrorState, LoadingState } from "../../src/components/StateViews";
import { useAuthStore } from "../../src/store/auth";
import { colors, spacing, typography } from "../../src/theme/tokens";
import { formatCurrency, formatDate, stripHtml } from "../../src/utils/format";

const fallbackImage = "https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=1400&auto=format&fit=crop";

export default function TournamentDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const value = Array.isArray(slug) ? slug[0] : slug;
  const tournament = useQuery({ queryKey: queryKeys.tournament(value), queryFn: () => contentApi.tournament(value), enabled: Boolean(value) });
  const register = useMutation({
    mutationFn: (id: string) => {
      if (!user?.phone) throw new Error("Hay cap nhat so dien thoai trong ho so truoc khi dang ky giai.");
      return contentApi.registerTournament(id, { contactPhone: user.phone });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tournaments }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tournament(value) })
      ]);
      Alert.alert("Da gui dang ky", "Chu giai dau se xu ly dang ky cua ban.");
    },
    onError: (error) => Alert.alert("Khong dang ky duoc", error instanceof Error ? error.message : "Vui long thu lai")
  });

  if (tournament.isLoading) return <Screen back><LoadingState /></Screen>;
  if (tournament.isError) return <Screen back><ErrorState message={tournament.error.message} onRetry={() => void tournament.refetch()} /></Screen>;
  if (!tournament.data) return <Screen back><ErrorState message="Khong tim thay giai dau" /></Screen>;
  const data = tournament.data;

  return (
    <Screen title={data.title} subtitle={data.court?.name ?? "Dia diem dang cap nhat"} back>
      <Image source={{ uri: data.coverImageUrl ?? data.court?.imageUrl ?? fallbackImage }} style={styles.cover} contentFit="cover" />
      <Card>
        <View style={styles.rowBetween}>
          <StatusBadge status={data.status} kind="plain" />
          <Text style={styles.strong}>{data.sportType}</Text>
        </View>
        <Text style={styles.body}>{stripHtml(data.description) || "Giai dau chua co mo ta chi tiet."}</Text>
      </Card>
      <Card>
        <Summary label="Thoi gian" value={`${formatDate(data.startDate)} - ${formatDate(data.endDate)}`} />
        <Summary label="Han dang ky" value={formatDate(data.registrationDeadline)} />
        <Summary label="Le phi" value={formatCurrency(data.entryFee)} />
        <Summary label="So luong" value={`${data.currentParticipants}/${data.maxParticipants}`} />
      </Card>
      {data.prizeDescription ? <Card><Text style={styles.body}>{data.prizeDescription}</Text></Card> : null}
      <Button
        loading={register.isPending}
        onPress={() => {
          if (!user) {
            router.push({ pathname: "/auth/login", params: { returnTo: `/tournaments/${data.slug}` } });
            return;
          }
          if (!user.phone) {
            Alert.alert("Can so dien thoai", "Hay cap nhat so dien thoai trong ho so truoc khi dang ky giai.", [
              { text: "De sau", style: "cancel" },
              { text: "Cap nhat", onPress: () => router.push("/profile/edit") }
            ]);
            return;
          }
          register.mutate(data.id);
        }}
      >
        Dang ky giai
      </Button>
      <Button variant="secondary" onPress={() => Linking.openURL(`sportbooking://tournaments/${data.slug}`)}>Chia se giai dau</Button>
    </Screen>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.rowBetween}>
      <Text style={styles.meta}>{label}</Text>
      <Text style={styles.strong}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    height: 240,
    borderRadius: 22,
    backgroundColor: colors.surfaceAlt
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  body: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 24
  },
  meta: {
    color: colors.muted,
    fontSize: typography.small
  },
  strong: {
    color: colors.ink,
    fontWeight: "900"
  }
});
