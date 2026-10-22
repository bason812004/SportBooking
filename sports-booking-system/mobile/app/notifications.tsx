import { FlatList, StyleSheet, Text, View } from "react-native";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { nextPageParam } from "../src/api/client";
import { notificationApi } from "../src/api/notifications";
import { queryKeys } from "../src/api/queryKeys";
import { Button } from "../src/components/Buttons";
import { Card, Screen } from "../src/components/Screen";
import { EmptyState, ErrorState, LoadMoreFooter, SkeletonCard } from "../src/components/StateViews";
import { colors, spacing, typography } from "../src/theme/tokens";
import { formatDateTime } from "../src/utils/format";

export default function NotificationsScreen() {
  const queryClient = useQueryClient();
  const notifications = useInfiniteQuery({
    queryKey: queryKeys.notifications,
    queryFn: ({ pageParam }) => notificationApi.listMine(pageParam),
    initialPageParam: 1,
    getNextPageParam: nextPageParam
  });
  const loadMore = () => {
    if (notifications.hasNextPage && !notifications.isFetchingNextPage) void notifications.fetchNextPage();
  };
  const markAll = useMutation({
    mutationFn: notificationApi.markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications })
  });

  return (
    <Screen title="Thong bao" subtitle="Cap nhat booking, voucher va thanh toan." back scroll={false} right={<Button variant="ghost" loading={markAll.isPending} onPress={() => markAll.mutate()}>Doc tat ca</Button>}>
      {notifications.isLoading ? <SkeletonCard /> : notifications.isError ? <ErrorState message={notifications.error.message} onRetry={() => void notifications.refetch()} /> : (
        <FlatList
          data={notifications.data?.pages.flatMap((page) => page.items) ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Card style={!item.isRead ? styles.unread : undefined}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.content}</Text>
              <Text style={styles.meta}>{formatDateTime(item.createdAt)}</Text>
            </Card>
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          contentContainerStyle={{ paddingBottom: 128 }}
          refreshing={notifications.isRefetching && !notifications.isFetchingNextPage}
          onRefresh={() => void notifications.refetch()}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={<LoadMoreFooter hasMore={notifications.hasNextPage} loading={notifications.isFetchingNextPage} onPress={loadMore} />}
          ListEmptyComponent={<EmptyState title="Chua co thong bao" message="Thong bao moi se hien tai day." />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  unread: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  title: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: "900"
  },
  body: {
    color: colors.text,
    fontSize: typography.small,
    lineHeight: 20
  },
  meta: {
    color: colors.muted,
    fontSize: typography.tiny,
    fontWeight: "700"
  }
});

