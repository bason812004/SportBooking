import { api } from "./client";
import type { ApiResponse, User } from "./types";

export const userApi = {
  async me() {
    const { data } = await api.get<ApiResponse<User>>("/users/me");
    return data.data;
  },
  async updateMe(payload: { fullName?: string; phone?: string; avatarUrl?: string }) {
    const { data } = await api.put<ApiResponse<User>>("/users/me", payload);
    return data.data;
  }
};

