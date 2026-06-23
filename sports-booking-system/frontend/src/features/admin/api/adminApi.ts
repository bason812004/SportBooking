import { api } from "../../../lib/axios";
import type {
  ApiResponse,
  AdminBooking,
  AdminCourt,
  AdminDashboard,
  AdminFinanceReport,
  AdminFinanceTransaction,
  AdminNotificationCampaign,
  AdminRefund,
  AdminPartner,
  AdminVoucher,
  AuditLog,
  BlockchainLog,
  Category,
  CommissionRateConfig,
  CommissionReport,
  Court,
  Paginated,
  User
} from "../../../types/api";

export const adminApi = {
  async dashboard() {
    const { data } = await api.get<ApiResponse<AdminDashboard>>("/admin/dashboard");
    return data.data;
  },
  async users(params: Record<string, string | number | undefined> = {}) {
    const { data } = await api.get<ApiResponse<Paginated<User>>>("/admin/users", { params: clean(params) });
    return data.data;
  },
  async bookings(params: Record<string, string | number | undefined> = {}) {
    const { data } = await api.get<ApiResponse<Paginated<AdminBooking>>>("/admin/bookings", { params: clean(params) });
    return data.data;
  },
  async bookingDetail(id: string) {
    const { data } = await api.get<ApiResponse<AdminBooking>>(`/admin/bookings/${id}`);
    return data.data;
  },
  async updateBookingAdmin(
    id: string,
    payload: {
      bookingStatus?: string;
      paymentStatus?: string;
      adminNote?: string;
      cancelReason?: string;
      refundAmount?: number;
      platformRetainedAmount?: number;
      actionNote?: string;
    }
  ) {
    const { data } = await api.patch<ApiResponse<AdminBooking>>(`/admin/bookings/${id}/admin`, payload);
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
  async partners(params: Record<string, string | number | undefined> = {}) {
    const { data } = await api.get<ApiResponse<Paginated<AdminPartner>>>("/admin/partners", { params: clean(params) });
    return data.data;
  },
  async partnerDetail(id: string) {
    const { data } = await api.get<ApiResponse<AdminPartner>>(`/admin/partners/${id}`);
    return data.data;
  },
  async approvePartner(id: string, reason?: string) {
    const { data } = await api.put<ApiResponse<unknown>>(`/admin/partners/${id}/approve`, { reason });
    return data.data;
  },
  async rejectPartner(id: string, reason: string) {
    const { data } = await api.put<ApiResponse<unknown>>(`/admin/partners/${id}/reject`, { reason });
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
  async financeTransactions(params: Record<string, string | number | undefined> = {}) {
    const { data } = await api.get<ApiResponse<Paginated<AdminFinanceTransaction>>>("/admin/finance/transactions", { params: clean(params) });
    return data.data;
  },
  async financeRefunds(params: Record<string, string | number | undefined> = {}) {
    const { data } = await api.get<ApiResponse<Paginated<AdminRefund>>>("/admin/finance/refunds", { params: clean(params) });
    return data.data;
  },
  async financeReconciliation(month: string) {
    const { data } = await api.get<ApiResponse<AdminFinanceReport>>("/admin/finance/reconciliation", { params: { month } });
    return data.data;
  },
  async updatePayout(partnerId: string, month: string, payload: { status: string; note?: string }) {
    const { data } = await api.patch<ApiResponse<unknown>>(`/admin/finance/payouts/${partnerId}`, payload, { params: { month } });
    return data.data;
  },
  async exportFinanceReport(month: string) {
    const { data } = await api.get<Blob>("/admin/finance/export", { params: { month }, responseType: "blob" });
    return data;
  },
  async notificationCampaigns(params: Record<string, string | number | undefined> = {}) {
    const { data } = await api.get<ApiResponse<Paginated<AdminNotificationCampaign>>>("/admin/notifications/campaigns", { params: clean(params) });
    return data.data;
  },
  async notificationCampaignDetail(id: string) {
    const { data } = await api.get<ApiResponse<AdminNotificationCampaign>>(`/admin/notifications/campaigns/${id}`);
    return data.data;
  },
  async createNotificationCampaign(payload: {
    title: string;
    content: string;
    type: string;
    targetType: string;
    targetRole?: string;
    targetUserId?: string;
    targetPartnerId?: string;
  }) {
    const { data } = await api.post<ApiResponse<AdminNotificationCampaign>>("/admin/notifications/campaigns", payload);
    return data.data;
  },
  async courts(params: Record<string, string | number | undefined> = {}) {
    const { data } = await api.get<ApiResponse<Paginated<AdminCourt>>>("/admin/courts", { params: clean(params) });
    return data.data;
  },
  async courtDetail(id: string) {
    const { data } = await api.get<ApiResponse<AdminCourt>>(`/admin/courts/${id}`);
    return data.data;
  },
  async updateCourtAdmin(id: string, payload: { activeStatus?: string; verified?: boolean; featured?: boolean; adminNote?: string }) {
    const { data } = await api.patch<ApiResponse<AdminCourt>>(`/admin/courts/${id}/admin`, payload);
    return data.data;
  },
  async requestCourtUpdate(id: string, note: string) {
    const { data } = await api.post<ApiResponse<AdminCourt>>(`/admin/courts/${id}/request-update`, { note });
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
  async updateCategory(id: string, payload: Partial<Category>) {
    const { data } = await api.put<ApiResponse<Category>>(`/admin/categories/${id}`, payload);
    return data.data;
  },
  async disableCategory(id: string) {
    const { data } = await api.delete<ApiResponse<Category>>(`/admin/categories/${id}`);
    return data.data;
  },
  async reviews() {
    const { data } = await api.get<ApiResponse<unknown[]>>("/admin/reviews");
    return data.data;
  },
  async setReviewStatus(id: string, action: "hide" | "show") {
    const { data } = await api.put<ApiResponse<unknown>>(`/admin/reviews/${id}/${action}`);
    return data.data;
  },
  async deleteReview(id: string) {
    const { data } = await api.delete<ApiResponse<unknown>>(`/admin/reviews/${id}`);
    return data.data;
  },
  async reports() {
    const { data } = await api.get<ApiResponse<unknown[]>>("/admin/reports");
    return data.data;
  },
  async setReportStatus(id: string, action: "resolve" | "reject") {
    const { data } = await api.put<ApiResponse<unknown>>(`/admin/reports/${id}/${action}`);
    return data.data;
  },
  async statistics() {
    const { data } = await api.get<ApiResponse<Record<string, unknown>>>("/admin/statistics");
    return data.data;
  },
  async vouchers(params: Record<string, string | number | undefined> = {}) {
    const { data } = await api.get<ApiResponse<Paginated<AdminVoucher>>>("/admin/vouchers", { params: clean(params) });
    return data.data;
  },
  async setVoucherStatus(id: string, action: "activate" | "disable", reason?: string) {
    const { data } = await api.put<ApiResponse<unknown>>(`/admin/vouchers/${id}/${action}`, { reason });
    return data.data;
  },
  async pendingBlogs(params: Record<string, string | number | undefined> = {}) {
    const { data } = await api.get<ApiResponse<Paginated<any>>>("/admin/blogs/pending", { params: clean(params) });
    return data.data;
  },
  async moderateBlog(id: string, action: "approve" | "reject", reason?: string) {
    const { data } = await api.put<ApiResponse<unknown>>(`/admin/blogs/${id}/${action}`, { reason });
    return data.data;
  },
  async pendingTournaments(params: Record<string, string | number | undefined> = {}) {
    const { data } = await api.get<ApiResponse<Paginated<any>>>("/admin/tournaments/pending", { params: clean(params) });
    return data.data;
  },
  async moderateTournament(id: string, action: "approve" | "reject", reason?: string) {
    const { data } = await api.put<ApiResponse<unknown>>(`/admin/tournaments/${id}/${action}`, { reason });
    return data.data;
  },
  async auditLogs(params: Record<string, string | number | undefined> = {}) {
    const { data } = await api.get<ApiResponse<Paginated<AuditLog>>>("/admin/audit-logs", { params: clean(params) });
    return data.data;
  },
  async verifyAuditLogs() {
    const { data } = await api.get<ApiResponse<{ valid: boolean; checked: number; brokenAt?: string | null }>>("/admin/audit-logs/verify");
    return data.data;
  },
  async blockchainLogs(params: Record<string, string | number | undefined> = {}) {
    const { data } = await api.get<ApiResponse<Paginated<BlockchainLog>>>("/admin/blockchain-logs", { params: clean(params) });
    return data.data;
  },
  async retryBlockchainLog(id: string) {
    const { data } = await api.put<ApiResponse<BlockchainLog>>(`/admin/blockchain-logs/${id}/retry`);
    return data.data;
  }
};

function clean(params: Record<string, string | number | undefined>) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== "" && value !== undefined));
}
