import { useState } from "react";
import { Link, useRouter } from "expo-router";
import { Plus, UsersRound } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { contentApi } from "../../src/api/content";
import { queryKeys } from "../../src/api/queryKeys";
import { Button, Chip } from "../../src/components/Buttons";
import { TeammateCard } from "../../src/components/Cards";
import { SearchInput } from "../../src/components/Forms";
import { Screen, SectionHeader } from "../../src/components/Screen";
import { EmptyState, ErrorState, SkeletonCard } from "../../src/components/StateViews";
import { useAuthStore } from "../../src/store/auth";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";

const sportFilters = ["Tất cả", "Bóng đá", "Cầu lông", "Pickleball", "Tennis", "Bóng rổ"];

export default function TeammatesScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [search, setSearch] = useState("");
  const [selectedSport, setSelectedSport] = useState("Tất cả");

  const posts = useQuery({
    queryKey: queryKeys.teamPosts(),
    queryFn: contentApi.teamPosts
  });

  const filteredPosts = (posts.data ?? []).filter((post) => {
    const matchSport = selectedSport === "Tất cả" || post.sportType?.toLowerCase() === selectedSport.toLowerCase();
    const matchSearch =
      !search.trim() ||
      post.title.toLowerCase().includes(search.toLowerCase()) ||
      post.courtName.toLowerCase().includes(search.toLowerCase()) ||
      post.address.toLowerCase().includes(search.toLowerCase());
    return matchSport && matchSearch;
  });

  return (
    <Screen
      title="Tìm Bạn & Ghép Đội"
      subtitle="Tham gia các nhóm chơi thể thao hoặc tự tạo nhóm tuyển thành viên."
      refreshing={posts.isRefetching}
      onRefresh={() => void posts.refetch()}
      right={
        <Button
          variant="primary"
          onPress={() => {
            if (!user) {
              router.push({ pathname: "/auth/login", params: { returnTo: "/teammates/create" } });
            } else {
              router.push("/teammates/create");
            }
          }}
        >
          Đăng bài
        </Button>
      }
    >
      <SearchInput value={search} onChangeText={setSearch} placeholder="Tìm bài đăng, tên sân, địa điểm..." />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer}>
        {sportFilters.map((sport) => (
          <Chip
            key={sport}
            label={sport}
            active={selectedSport === sport}
            onPress={() => setSelectedSport(sport)}
          />
        ))}
      </ScrollView>

      <SectionHeader
        title={`Bài đăng tìm bạn (${filteredPosts.length})`}
        action={
          user ? (
            <Link href="/profile/joined-groups" style={styles.link}>
              Nhóm của tôi
            </Link>
          ) : undefined
        }
      />

      {posts.isLoading ? (
        <SkeletonCard />
      ) : posts.isError ? (
        <ErrorState message={posts.error.message} onRetry={() => void posts.refetch()} />
      ) : filteredPosts.length === 0 ? (
        <EmptyState
          title="Chưa có bài đăng nào"
          message="Hãy là người đầu tiên tạo nhóm ghép đội và mời bạn bè tham gia!"
          action={
            <Button
              variant="primary"
              onPress={() => {
                if (!user) {
                  router.push({ pathname: "/auth/login", params: { returnTo: "/teammates/create" } });
                } else {
                  router.push("/teammates/create");
                }
              }}
            >
              Tạo bài đăng mới
            </Button>
          }
        />
      ) : (
        <View style={styles.list}>
          {filteredPosts.map((post) => (
            <TeammateCard key={post.id} post={post} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipsContainer: {
    gap: spacing.sm,
    paddingVertical: spacing.xs
  },
  link: {
    color: colors.primary,
    fontWeight: "900",
    fontSize: typography.small
  },
  list: {
    gap: spacing.md
  }
});
