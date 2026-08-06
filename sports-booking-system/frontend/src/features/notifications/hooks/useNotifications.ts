import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/hooks/useAuth";
import { notificationApi } from "../api/notificationApi";

export function useMyNotifications() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["my-notifications"],
    queryFn: notificationApi.listMine,
    enabled: isAuthenticated
  });
}

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
