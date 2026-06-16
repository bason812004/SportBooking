import { api } from "../../../lib/axios";
import type {
  ApiResponse,
  Category,
  CommissionRateConfig,
  CommissionReport,
  Court,
  Paginated,
  User
} from "../../../types/api";

export const adminApi = {
  async dashboard() {
    const { data } = await api.get<ApiResponse<Record<string, number>>>("/admin/dashboard");
    return data.data;
  },
  async users() {
    const { data } = await api.get<ApiResponse<Paginated<User>>>("/admin/users");
    return data.data;
  },
  async lockUser(id: string) {
    const { data } = await api.put<ApiResponse<User>>(`/admin/users/${id}/lock`);
    return data.data;
  },
  async unlockUser(id: string) {
    const { data } = await api.put<ApiResponse<User>>(`/admin/users/${id}/unlock`);
    return data.data;
  },
  async partners() {
    const { data } = await api.get<ApiResponse<Paginated<unknown>>>("/admin/partners");
    return data.data;
  },
  async approvePartner(id: string) {
    const { data } = await api.put<ApiResponse<unknown>>(`/admin/partners/${id}/approve`);
    return data.data;
  },
  async rejectPartner(id: string) {
    const { data } = await api.put<ApiResponse<unknown>>(`/admin/partners/${id}/reject`);
    return data.data;
  },
  async commissionDefault() {
    const { data } = await api.get<ApiResponse<{ rate: number }>>("/admin/commission/default");
    return data.data;
  },
  async updateCommissionDefault(rate: number) {
    const { data } = await api.patch<ApiResponse<{ rate: number }>>("/admin/commission/default", { rate });
    return data.data;
  },
  async partnerCommission(id: string) {
    const { data } = await api.get<ApiResponse<CommissionRateConfig>>(`/admin/commission/partner/${id}`);
    return data.data;
  },
  async updatePartnerCommission(id: string, rate: number | null) {
    const { data } = await api.patch<ApiResponse<CommissionRateConfig>>(
      `/admin/commission/partner/${id}`,
      { rate }
    );
    return data.data;
  },
  async commissionReport(month: string) {
    const { data } = await api.get<ApiResponse<CommissionReport>>("/admin/commission/report", {
      params: { month }
    });
    return data.data;
  },
  async pendingCourts() {
    const { data } = await api.get<ApiResponse<Court[]>>("/admin/courts/pending");
    return data.data;
  },
  async approveCourt(id: string) {
    const { data } = await api.put<ApiResponse<Court>>(`/admin/courts/${id}/approve`);
    return data.data;
  },
  async rejectCourt(id: string, reason: string) {
    const { data } = await api.put<ApiResponse<Court>>(`/admin/courts/${id}/reject`, { reason });
    return data.data;
  },
  async categories() {
    const { data } = await api.get<ApiResponse<Category[]>>("/admin/categories");
    return data.data;
  },
  async createCategory(payload: Partial<Category>) {
    const { data } = await api.post<ApiResponse<Category>>("/admin/categories", payload);
    return data.data;
  },
  async reviews() {
    const { data } = await api.get<ApiResponse<unknown[]>>("/admin/reviews");
    return data.data;
  },
  async reports() {
    const { data } = await api.get<ApiResponse<unknown[]>>("/admin/reports");
    return data.data;
  },
  async statistics() {
    const { data } = await api.get<ApiResponse<Record<string, unknown>>>("/admin/statistics");
    return data.data;
  }
};
