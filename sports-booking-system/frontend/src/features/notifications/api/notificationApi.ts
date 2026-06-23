import { api } from "../../../lib/axios";
import type { ApiResponse, Paginated } from "../../../types/api";

export type NotificationItem = {
  id: string;
  title: string;
  content: string;
  type: string;
  metadata?: unknown;
  isRead: boolean;
  createdAt: string;
};

export const notificationApi = {
  async listMine() {
    const { data } = await api.get<ApiResponse<Paginated<NotificationItem>>>("/users/me/notifications");
    return data.data;
  },
  async markRead(id: string) {
    const { data } = await api.put<ApiResponse<NotificationItem>>(`/users/me/notifications/${id}/read`);
    return data.data;
  },
  async markAllRead() {
    const { data } = await api.put<ApiResponse<{ updated: number }>>("/users/me/notifications/read-all");
    return data.data;
  }
};
