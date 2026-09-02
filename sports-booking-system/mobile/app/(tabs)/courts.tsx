import { useLocalSearchParams } from "expo-router";
import { SlidersHorizontal } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { courtApi, type CourtFilters } from "../../src/api/courts";
import { queryKeys } from "../../src/api/queryKeys";
import { Chip } from "../../src/components/Buttons";
import { CourtCard } from "../../src/components/Cards";
import { SearchInput } from "../../src/components/Forms";
import { Screen } from "../../src/components/Screen";
import { EmptyState, ErrorState, SkeletonCard } from "../../src/components/StateViews";
import { colors, spacing, typography } from "../../src/theme/tokens";

const SORT_OPTIONS = [
  { key: "newest", label: "Mới nhất" },
  { key: "rating", label: "Đánh giá cao" },
  { key: "price_asc", label: "Giá thấp" }
];

export default function CourtsScreen() {
  const params = useLocalSearchParams<{ q?: string; categoryId?: string }>();
  const [keyword, setKeyword] = useState(params.q ?? "");
  const [debounced, setDebounced] = useState(params.q ?? "");
  const [categoryId, setCategoryId] = useState(params.categoryId ?? "");
  const [sortIndex, setSortIndex] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(keyword), 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  const currentSort = SORT_OPTIONS[sortIndex];

  const filters: CourtFilters = useMemo(
    () => ({
      q: debounced,
      categoryId,
      sortBy: currentSort.key,
      page: 1,
      limit: 20
    }),
    [debounced, categoryId, currentSort.key]
  );

  const courts = useQuery({
    queryKey: queryKeys.courts(filters),
    queryFn: () => courtApi.list(filters),
    staleTime: 60 * 1000
  });

  const categories = useQuery({
    queryKey: queryKeys.categories,
    queryFn: courtApi.categories,
    staleTime: 10 * 60 * 1000
  });

  function cycleSort() {
    setSortIndex((prev) => (prev + 1) % SORT_OPTIONS.length);
  }

  return (
    <Screen title="Tìm Sân Thể Thao" subtitle="Khám phá và đặt sân theo môn, địa chỉ và mức giá." scroll={false}>
      <SearchInput value={keyword} onChangeText={setKeyword} placeholder="Tìm tên sân, địa chỉ, quận huyện..." />

      <View style={styles.filterHeader}>
        <Text style={styles.filterTitle}>Môn thể thao</Text>
        <Pressable onPress={cycleSort} style={styles.sortButton}>
          <SlidersHorizontal size={16} color={colors.primary} />
          <Text style={styles.sortText}>{currentSort.label}</Text>
        </Pressable>
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ id: "", name: "Tất cả" }, ...(categories.data ?? [])]}
        keyExtractor={(item) => item.id || "all"}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.sm }}
        renderItem={({ item }) => (
          <Chip label={item.name} active={item.id === categoryId} onPress={() => setCategoryId(item.id)} />
        )}
      />

      {courts.isLoading ? (
        <View style={{ gap: spacing.md }}>
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </View>
      ) : courts.isError ? (
        <ErrorState message={courts.error.message} onRetry={() => void courts.refetch()} />
      ) : (
        <FlatList
          data={courts.data?.items ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <CourtCard court={item} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          contentContainerStyle={{ paddingBottom: 100 }}
          removeClippedSubviews={true}
          maxToRenderPerBatch={6}
          windowSize={5}
          initialNumToRender={5}
          refreshing={courts.isRefetching}
          onRefresh={() => void courts.refetch()}
          ListEmptyComponent={
            <EmptyState
              title="Không tìm thấy sân phù hợp"
              message="Hãy thử tìm kiếm với từ khóa khác hoặc bỏ bớt bộ lọc."
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: spacing.xs
  },
  filterTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: "900"
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999
  },
  sortText: {
    color: colors.primaryDark,
    fontWeight: "900",
    fontSize: typography.small
  }
});
