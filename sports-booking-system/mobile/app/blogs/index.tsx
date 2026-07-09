import { FlatList, View } from "react-native";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { contentApi } from "../../src/api/content";
import { queryKeys } from "../../src/api/queryKeys";
import { BlogCard } from "../../src/components/Cards";
import { SearchInput } from "../../src/components/Forms";
import { Screen } from "../../src/components/Screen";
import { EmptyState, ErrorState, SkeletonCard } from "../../src/components/StateViews";
import { spacing } from "../../src/theme/tokens";

export default function BlogsScreen() {
  const [search, setSearch] = useState("");
  const blogs = useQuery({ queryKey: queryKeys.blogs({ search }), queryFn: () => contentApi.blogs({ search }) });
  return (
    <Screen title="Blog" subtitle="Tin moi va kinh nghiem dat san." back scroll={false}>
      <SearchInput value={search} onChangeText={setSearch} placeholder="Tim bai viet" />
      {blogs.isLoading ? <SkeletonCard /> : blogs.isError ? <ErrorState message={blogs.error.message} onRetry={() => void blogs.refetch()} /> : (
        <FlatList
          data={blogs.data ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <BlogCard post={item} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          contentContainerStyle={{ paddingBottom: 128 }}
          refreshing={blogs.isRefetching}
          onRefresh={() => void blogs.refetch()}
          ListEmptyComponent={<EmptyState title="Khong co bai viet" message="Thu tu khoa khac." />}
        />
      )}
    </Screen>
  );
}

