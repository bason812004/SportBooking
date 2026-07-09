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

export default function CourtsScreen() {
  const params = useLocalSearchParams<{ q?: string; categoryId?: string }>();
  const [keyword, setKeyword] = useState(params.q ?? "");
  const [debounced, setDebounced] = useState(params.q ?? "");
  const [categoryId, setCategoryId] = useState(params.categoryId ?? "");
  const [sortBy, setSortBy] = useState("newest");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(keyword), 350);
    return () => clearTimeout(timer);
  }, [keyword]);

  const filters: CourtFilters = useMemo(() => ({ q: debounced, categoryId, sortBy, page: 1, limit: 30 }), [debounced, categoryId, sortBy]);
  const courts = useQuery({ queryKey: queryKeys.courts(filters), queryFn: () => courtApi.list(filters) });
  const categories = useQuery({ queryKey: queryKeys.categories, queryFn: courtApi.categories });

  return (
    <Screen title="Tim san" subtitle="Tim theo ten san, dia chi, bo mon va gia." scroll={false}>
      <SearchInput value={keyword} onChangeText={setKeyword} />
      <View style={styles.filterHeader}>
        <Text style={styles.filterTitle}>Bo loc nhanh</Text>
        <Pressable onPress={() => setSortBy((value) => value === "newest" ? "name" : "newest")} style={styles.sortButton}>
          <SlidersHorizontal size={17} color={colors.primary} />
          <Text style={styles.sortText}>{sortBy === "newest" ? "Moi nhat" : "Theo ten"}</Text>
        </Pressable>
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ id: "", name: "Tat ca" }, ...(categories.data ?? [])]}
        keyExtractor={(item) => item.id || "all"}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.sm }}
        renderItem={({ item }) => <Chip label={item.name} active={item.id === categoryId} onPress={() => setCategoryId(item.id)} />}
      />
      {courts.isLoading ? (
        <View style={{ gap: spacing.md }}>{Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)}</View>
      ) : courts.isError ? (
        <ErrorState message={courts.error.message} onRetry={() => void courts.refetch()} />
      ) : (
        <FlatList
          data={courts.data?.items ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <CourtCard court={item} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          contentContainerStyle={{ paddingBottom: 128 }}
          refreshing={courts.isRefetching}
          onRefresh={() => void courts.refetch()}
          ListEmptyComponent={<EmptyState title="Khong co san phu hop" message="Thu xoa bot bo loc hoac tim tu khoa khac." />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  filterTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: "900"
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  sortText: {
    color: colors.primary,
    fontWeight: "900"
  }
});

