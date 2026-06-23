import { api } from "../../../lib/axios";
import type { ApiResponse, User } from "../../../types/api";

export const userApi = {
  async updateMe(payload: { fullName?: string; phone?: string; avatarUrl?: string }) {
    const { data } = await api.put<ApiResponse<User>>("/users/me", payload);
    return data.data;
  }
};
