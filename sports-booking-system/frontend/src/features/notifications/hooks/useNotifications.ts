import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/hooks/useAuth";
import { notificationApi } from "../api/notificationApi";

export function useMyNotifications() {
  const { isAuthenticated, user } = useAuth();
  return useInfiniteQuery({
    queryKey: ["my-notifications", user?.id],
    queryFn: ({ pageParam }) => notificationApi.listMine(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
    enabled: isAuthenticated,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 30000
  });
}

/** One page of the inbox for the full notifications page; the bell keeps its own endless list. */
export function useNotificationPage(page: number, limit: number, unread: boolean) {
  const { isAuthenticated, user } = useAuth();
  return useQuery({
    queryKey: ["my-notifications", user?.id, "page", page, limit, unread],
    queryFn: () => notificationApi.listMine(page, { limit, unread }),
    enabled: isAuthenticated,
    placeholderData: keepPreviousData
  });
}

// Both the bell and the notifications page live under ["my-notifications"], so one read updates both.
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-notifications"] })
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-notifications"] })
  });
}
