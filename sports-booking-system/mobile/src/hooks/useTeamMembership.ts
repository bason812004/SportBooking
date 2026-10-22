import { useQuery } from "@tanstack/react-query";
import { contentApi } from "../api/content";
import { queryKeys } from "../api/queryKeys";

// Check the current user's access without requesting the protected member list.
export function useTeamMembership(id: string, userId?: string) {
  return useQuery({
    queryKey: queryKeys.teamPostMembership(id, userId),
    queryFn: () => contentApi.teamPostMembership(id),
    enabled: Boolean(id && userId),
    staleTime: 0,
    retry: false
  });
}
