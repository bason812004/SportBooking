import { useState } from "react";
import { useRouter } from "expo-router";
import { MessageSquare, UsersRound, Plus } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { contentApi } from "../../src/api/content";
import { queryKeys } from "../../src/api/queryKeys";
import { Button, Chip } from "../../src/components/Buttons";
import { TeammateCard } from "../../src/components/Cards";
import { Card, Screen } from "../../src/components/Screen";
import { EmptyState, ErrorState, SkeletonCard } from "../../src/components/StateViews";
import { colors, spacing, typography } from "../../src/theme/tokens";

export default function JoinedGroupsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<"joined" | "mine">("joined");

  const joined = useQuery({
    queryKey: queryKeys.joinedTeamPosts,
    queryFn: contentApi.joinedTeamPosts,
    enabled: tab === "joined"
  });

  const mine = useQuery({
    queryKey: queryKeys.myTeamPosts,
    queryFn: contentApi.myTeamPosts,
    enabled: tab === "mine"
  });

  const activeQuery = tab === "joined" ? joined : mine;
  const list = activeQuery.data ?? [];

  return (
    <Screen
      title="Nhóm Ghép Đội Của Tôi"
      subtitle="Quản lý các nhóm bạn đã tham gia hoặc bài đăng tìm bạn của bạn."
      back
      refreshing={activeQuery.isRefetching}
      onRefresh={() => void activeQuery.refetch()}
      right={
        <Button variant="primary" onPress={() => router.push("/teammates/create")}>
          Đăng bài mới
        </Button>
      }
    >
      <View style={styles.tabsRow}>
        <Chip
          label="Nhóm đã tham gia"
          active={tab === "joined"}
          onPress={() => setTab("joined")}
        />
        <Chip
          label="Bài đăng của tôi"
          active={tab === "mine"}
          onPress={() => setTab("mine")}
        />
      </View>

      {activeQuery.isLoading ? (
        <SkeletonCard />
      ) : activeQuery.isError ? (
        <ErrorState message={activeQuery.error.message} onRetry={() => void activeQuery.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          title={tab === "joined" ? "Chưa tham gia nhóm nào" : "Chưa có bài đăng nào"}
          message={tab === "joined" ? "Khám phá các bài tìm bạn và tham gia thi đấu ngay!" : "Đăng bài để tìm đồng đội đá bóng, đánh cầu..."}
          action={
            <Button
              variant="primary"
              onPress={() => router.push(tab === "joined" ? "/(tabs)/teammates" : "/teammates/create")}
            >
              {tab === "joined" ? "Tìm nhóm ghép" : "Tạo bài đăng"}
            </Button>
          }
        />
      ) : (
        <View style={styles.list}>
          {list.map((post) => (
            <TeammateCard key={post.id} post={post} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  list: {
    gap: spacing.md
  }
});
