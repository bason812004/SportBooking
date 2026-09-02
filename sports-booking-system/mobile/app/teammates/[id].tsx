import { useLocalSearchParams, useRouter } from "expo-router";
import { CalendarDays, Clock, MapPin, MessageSquare, Share2, UsersRound, UserCheck } from "lucide-react-native";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { contentApi } from "../../src/api/content";
import { queryKeys } from "../../src/api/queryKeys";
import { Button } from "../../src/components/Buttons";
import { Card, Screen, SectionHeader } from "../../src/components/Screen";
import { ErrorState, LoadingState } from "../../src/components/StateViews";
import { StickyBottomAction } from "../../src/components/StickyBottomAction";
import { useAuthStore } from "../../src/store/auth";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";
import { formatCurrency, formatDate } from "../../src/utils/format";

export default function TeammateDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const post = useQuery({
    queryKey: queryKeys.teamPost(id),
    queryFn: () => contentApi.teamPost(id),
    enabled: Boolean(id)
  });

  const members = useQuery({
    queryKey: queryKeys.teamPostMembers(id),
    queryFn: () => contentApi.teamPostMembers(id),
    enabled: Boolean(id)
  });

  const isMember = (members.data ?? []).some((m) => m.userId === user?.id) || post.data?.createdBy?.id === user?.id;

  const joinMutation = useMutation({
    mutationFn: () => contentApi.joinTeamPost(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.teamPost(id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.teamPostMembers(id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.joinedTeamPosts })
      ]);
      Alert.alert("Thành công", "Bạn đã tham gia nhóm thành công!", [
        {
          text: "Vào phòng Chat",
          onPress: () => router.push(`/team-groups/${id}/chat`)
        },
        { text: "Ở lại", style: "cancel" }
      ]);
    },
    onError: (error) => Alert.alert("Không thể tham gia", error instanceof Error ? error.message : "Vui lòng thử lại sau.")
  });

  if (post.isLoading) return <Screen back><LoadingState label="Đang tải thông tin nhóm..." /></Screen>;
  if (post.isError) return <Screen back><ErrorState message={post.error.message} onRetry={() => void post.refetch()} /></Screen>;
  if (!post.data) return <Screen back><ErrorState message="Không tìm thấy bài đăng." /></Screen>;

  const data = post.data;
  const isFull = data.currentPlayers >= data.maxPlayers;
  const isHost = data.createdBy?.id === user?.id;

  return (
    <View style={{ flex: 1 }}>
      <Screen title={data.title} subtitle={`${data.sportType} · ${data.courtName}`} back>
        {/* Info Card */}
        <Card style={{ gap: spacing.sm }}>
          <View style={styles.rowBetween}>
            <Text style={styles.sportBadge}>{data.sportType}</Text>
            <View style={styles.inline}>
              <UsersRound size={15} color={colors.primary} />
              <Text style={styles.strong}>{data.currentPlayers}/{data.maxPlayers} người</Text>
            </View>
          </View>

          <Text style={styles.title}>{data.title}</Text>

          <View style={styles.inline}>
            <MapPin size={16} color={colors.primary} />
            <Text style={styles.meta}>{data.courtName} - {data.address}</Text>
          </View>

          <View style={styles.inline}>
            <CalendarDays size={16} color={colors.muted} />
            <Text style={styles.meta}>
              {data.playingDate ? formatDate(data.playingDate) : "Linh hoạt"}
            </Text>
          </View>

          <View style={styles.inline}>
            <Clock size={16} color={colors.muted} />
            <Text style={styles.meta}>
              {(data.startTime || "").slice(0, 5)} - {(data.endTime || "").slice(0, 5)}
            </Text>
          </View>

          <View style={[styles.rowBetween, styles.divider]}>
            <Text style={styles.meta}>Chi phí dự kiến</Text>
            <Text style={styles.price}>
              {data.pricePerPerson > 0 ? `${formatCurrency(data.pricePerPerson)}/người` : "Miễn phí"}
            </Text>
          </View>
        </Card>

        {/* Host Info */}
        <SectionHeader title="Chủ bài đăng" />
        <Card style={styles.rowBetween}>
          <View style={styles.inline}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {data.createdBy?.fullName?.charAt(0)?.toUpperCase() || "U"}
              </Text>
            </View>
            <View>
              <Text style={styles.strong}>{data.createdBy?.fullName || "Chủ nhóm"}</Text>
              <Text style={styles.meta}>Người tạo nhóm ghép đội</Text>
            </View>
          </View>
          {isHost && (
            <Text style={styles.hostBadge}>Bạn là chủ nhóm</Text>
          )}
        </Card>

        {/* Note / Description */}
        {data.note && (
          <>
            <SectionHeader title="Ghi chú từ chủ nhóm" />
            <Card>
              <Text style={styles.body}>{data.note}</Text>
            </Card>
          </>
        )}

        {/* Members List */}
        <SectionHeader title={`Thành viên tham gia (${members.data?.length ?? data.currentPlayers})`} />
        <Card style={{ gap: spacing.sm }}>
          {members.isLoading ? (
            <LoadingState label="Đang tải danh sách thành viên..." />
          ) : members.data?.length ? (
            members.data.map((member) => (
              <View key={member.userId} style={styles.memberRow}>
                <View style={styles.inline}>
                  <View style={[styles.avatar, { width: 34, height: 34 }]}>
                    <Text style={[styles.avatarText, { fontSize: 13 }]}>
                      {member.fullName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.memberName}>{member.fullName}</Text>
                </View>
                <Text style={member.role === "OWNER" ? styles.ownerRole : styles.memberRole}>
                  {member.role === "OWNER" ? "Trưởng nhóm" : "Thành viên"}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.meta}>Chưa có danh sách chi tiết.</Text>
          )}
        </Card>
      </Screen>

      {/* Sticky Bottom Bar */}
      <StickyBottomAction>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.meta}>Trạng thái</Text>
            <Text style={styles.statusText}>
              {isMember ? "Đã tham gia" : isFull ? "Đã đủ người" : `Còn thiếu ${data.maxPlayers - data.currentPlayers} người`}
            </Text>
          </View>

          {isMember ? (
            <Button
              variant="primary"
              onPress={() => router.push(`/team-groups/${id}/chat`)}
            >
              Vào phòng Chat
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={isFull || joinMutation.isPending}
              loading={joinMutation.isPending}
              onPress={() => {
                if (!user) {
                  router.push({ pathname: "/auth/login", params: { returnTo: `/teammates/${id}` } });
                } else {
                  joinMutation.mutate();
                }
              }}
            >
              {isFull ? "Đã đủ người" : "Tham gia nhóm"}
            </Button>
          )}
        </View>
      </StickyBottomAction>
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
  inline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  sportBadge: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.sm,
    textTransform: "uppercase"
  },
  title: {
    color: colors.ink,
    fontSize: typography.h2,
    fontWeight: "900",
    lineHeight: 24
  },
  meta: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 20
  },
  strong: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: "900"
  },
  price: {
    color: colors.primaryDark,
    fontSize: typography.h2,
    fontWeight: "900"
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.sm,
    marginTop: spacing.xs
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: "900"
  },
  hostBadge: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm
  },
  body: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 22
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  memberName: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: "800"
  },
  ownerRole: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm
  },
  memberRole: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted
  },
  statusText: {
    fontSize: typography.body,
    fontWeight: "900",
    color: colors.ink
  }
});
