import { FlatList, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { contentApi } from "../../src/api/content";
import { queryKeys } from "../../src/api/queryKeys";
import { TournamentCard } from "../../src/components/Cards";
import { Screen } from "../../src/components/Screen";
import { EmptyState, ErrorState, SkeletonCard } from "../../src/components/StateViews";
import { spacing } from "../../src/theme/tokens";

export default function TournamentsScreen() {
  const tournaments = useQuery({ queryKey: queryKeys.tournaments, queryFn: contentApi.tournaments });
  return (
    <Screen title="Giai dau" subtitle="Xem cac giai dau cong khai." back scroll={false}>
      {tournaments.isLoading ? <SkeletonCard /> : tournaments.isError ? <ErrorState message={tournaments.error.message} onRetry={() => void tournaments.refetch()} /> : (
        <FlatList
          data={tournaments.data ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <TournamentCard tournament={item} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          contentContainerStyle={{ paddingBottom: 128 }}
          refreshing={tournaments.isRefetching}
          onRefresh={() => void tournaments.refetch()}
          ListEmptyComponent={<EmptyState title="Chua co giai dau" message="Cac giai moi se xuat hien tai day." />}
        />
      )}
    </Screen>
  );
}

