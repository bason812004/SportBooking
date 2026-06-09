import { api } from "../../../lib/axios";
import type { ApiResponse, BlogPost, Tournament, Voucher } from "../../../types/api";

export const contentApi = {
  async vouchers() {
    const { data } = await api.get<ApiResponse<Voucher[]>>("/vouchers");
    return data.data;
  },

  async blogs() {
    const { data } = await api.get<ApiResponse<BlogPost[]>>("/blogs");
    return data.data;
  },

  async tournaments() {
    const { data } = await api.get<ApiResponse<Tournament[]>>("/tournaments");
    return data.data;
  }
};
