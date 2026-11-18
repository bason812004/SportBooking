import { api } from "../../../lib/axios";
import type {
  ApiResponse,
  AdminBooking,
  AdminBookingFilterOptions,
  AdminCategory,
  AdminCourt,
  AdminUser,
  AdminCourtReview,
  CourtApprovalRevocation,
  AdminDashboard,
  AdminFinanceReport,
  AdminReviewStats,
  NotificationRecipientGroup,
  AdminFinanceTransaction,
  AdminBlog,
  AdminBlogComment,
  AdminCampaignRecipient,
  ModerationHistoryEntry,
  OverdueBooking,
  AdminNotificationCampaign,
  AdminRefund,
  AdminPartner,
  AdminPartnerListItem,
  AdminPendingCourt,
  AdminVoucher,
  AdminVoucherDetail,
  AdminVoucherInput,
  AdminReport,
  AdminReportThread,
  ReportDecisionPayload,
  ReportThreadEntry,
  AuditLog,
  BlockchainLog,
  Category,
  CommissionDefault,
  CommissionRateChange,
  CommissionRateConfig,
  CommissionReport,
  Court,
  ModeratedReview,
  Paginated,
  PartnerWallet,
  Settlement,
  SettlementSummary,
  User,
  VoucherRunningInput,
  WalletAdminSummary,
  WithdrawalRequest,
  WithdrawalSummary
} from "../../../types/api";

export const adminApi = {
  async dashboard() {
    const { data } = await api.get<ApiResponse<AdminDashboard>>("/admin/dashboard");
    return data.data;
  },
  async users(params: Record<string, string | number | undefined> = {}) {
    const { data } = await api.get<ApiResponse<Paginated<AdminUser>>>("/admin/users", { params: clean(params) });
    return data.data;
  },
  async bookings(params: Record<string, string | number | undefined> = {}) {
    const { data } = await api.get<ApiResponse<Paginated<AdminBooking>>>("/admin/bookings", { params: clean(params) });
    return data.data;
  },
  async bookingFilterOptions() {
    const { data } = await api.get<ApiResponse<AdminBookingFilterOptions>>("/admin/bookings/filter-options");
    return data.data;
  },
  /** Bookings of every court that are over but still open, with when the system finishes each. */
  async overdueBookings() {
    const { data } = await api.get<ApiResponse<OverdueBooking[]>>("/admin/bookings/overdue");
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
  async lockUser(id: string, reason?: string) {
    const { data } = await api.put<ApiResponse<User>>(`/admin/users/${id}/lock`, { reason });
    return data.data;
  },
  async unlockUser(id: string) {
    const { data } = await api.put<ApiResponse<User>>(`/admin/users/${id}/unlock`);
    return data.data;
  },
  async partners(params: Record<string, string | number | undefined> = {}) {
    const { data } = await api.get<ApiResponse<Paginated<AdminPartnerListItem>>>("/admin/partners", { params: clean(params) });
    return data.data;
  },
  /** The partner list with the page's search and status, every page of it (account numbers masked). */
  async exportPartners(params: { search?: string; status?: string }, format: "excel" | "pdf") {
    const { data } = await api.get<Blob>("/admin/partners/export", { params: clean({ ...params, format }), responseType: "blob" });
    return data;
  },
  /** Customers (role USER) with the user list's search and status, every page of it. */
  async exportCustomers(params: { search?: string; status?: string }, format: "excel" | "pdf") {
    const { data } = await api.get<Blob>("/admin/users/export", { params: clean({ ...params, format }), responseType: "blob" });
    return data;
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
    const { data } = await api.get<ApiResponse<CommissionDefault>>("/admin/commission/default");
    return data.data;
  },
  async commissionHistory() {
    const { data } = await api.get<ApiResponse<CommissionRateChange[]>>("/admin/commission/history");
    return data.data;
  },
  /** Every partner's rate with the day it took effect, and the whole change history. */
  async exportCommission(format: "excel" | "pdf") {
    const { data } = await api.get<Blob>("/admin/commission/export", { params: { format }, responseType: "blob" });
    return data;
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
    targetUserIds?: string[];
  }) {
    const { data } = await api.post<ApiResponse<AdminNotificationCampaign>>("/admin/notifications/campaigns", payload);
    return data.data;
  },
  /** The recipient picker's tree: active accounts by role, per partner (owner and staff) or per court (its customers). */
  async notificationRecipientGroups(by: "role" | "partner" | "court") {
    const { data } = await api.get<ApiResponse<NotificationRecipientGroup[]>>("/admin/notifications/recipient-groups", { params: { by } });
    return data.data;
  },
  /** How many active accounts a campaign to this audience would reach (the sender excluded from groups). */
  async notificationAudience(params: { targetType: string; targetRole?: string; targetUserId?: string; targetPartnerId?: string }) {
    const { data } = await api.get<ApiResponse<{ count: number }>>("/admin/notifications/audience", { params: clean(params) });
    return data.data;
  },
  async notificationCampaignRecipients(id: string, params: Record<string, string | number | undefined> = {}) {
    const { data } = await api.get<ApiResponse<Paginated<AdminCampaignRecipient>>>(`/admin/notifications/campaigns/${id}/recipients`, {
      params: clean(params)
    });
    return data.data;
  },
  /** Removes the campaign's notifications from every inbox; the reason is kept in the history. */
  async recallNotificationCampaign(id: string, reason: string) {
    const { data } = await api.post<ApiResponse<{ id: string; removed: number }>>(`/admin/notifications/campaigns/${id}/recall`, { reason });
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
  /** Locking (activeStatus INACTIVE) needs lockReason, sent to the partner. */
  async updateCourtAdmin(id: string, payload: { activeStatus?: string; lockReason?: string; verified?: boolean; featured?: boolean; adminNote?: string }) {
    const { data } = await api.patch<ApiResponse<AdminCourt>>(`/admin/courts/${id}/admin`, payload);
    return data.data;
  },
  async requestCourtUpdate(id: string, note: string) {
    const { data } = await api.post<ApiResponse<AdminCourt>>(`/admin/courts/${id}/request-update`, { note });
    return data.data;
  },
  async pendingCourts(params: Record<string, string | number | undefined> = {}) {
    const { data } = await api.get<ApiResponse<Paginated<AdminPendingCourt>>>("/admin/courts/pending", { params: clean(params) });
    return data.data;
  },
  async courtReview(id: string) {
    const { data } = await api.get<ApiResponse<AdminCourtReview>>(`/admin/courts/${id}/review`);
    return data.data;
  },
  /** approvedImages: the photos still pending that were approved with the court. */
  async approveCourt(id: string) {
    const { data } = await api.put<ApiResponse<{ id: string; approvalStatus: "APPROVED"; approvedImages: number }>>(`/admin/courts/${id}/approve`);
    return data.data;
  },
  async rejectCourt(id: string, reason: string) {
    const { data } = await api.put<ApiResponse<Court>>(`/admin/courts/${id}/reject`, { reason });
    return data.data;
  },
  /** Until when an approval can be taken back, and the upcoming bookings that stand if it is. */
  async approvalRevocation(id: string) {
    const { data } = await api.get<ApiResponse<CourtApprovalRevocation>>(`/admin/courts/${id}/approval-revocation`);
    return data.data;
  },
  /** Sends an approved court back to PENDING; notifiedBookings: customers told their booking stands. */
  async revokeCourtApproval(id: string, reason: string) {
    const { data } = await api.put<ApiResponse<{ id: string; approvalStatus: "PENDING"; notifiedBookings: number }>>(`/admin/courts/${id}/revoke-approval`, { reason });
    return data.data;
  },
  async categories() {
    const { data } = await api.get<ApiResponse<AdminCategory[]>>("/admin/categories");
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
  async reviews(params: Record<string, string | number | undefined> = {}) {
    const { data } = await api.get<ApiResponse<Paginated<ModeratedReview>>>("/admin/reviews", { params: clean(params) });
    return data.data;
  },
  async reviewStats(params: { partnerId?: string; courtId?: string; fromDate?: string } = {}) {
    const { data } = await api.get<ApiResponse<AdminReviewStats>>("/admin/reviews/stats", { params: clean(params) });
    return data.data;
  },
  /** The review statistics (same partner, court and period) as an Excel workbook or a PDF. */
  async exportReviewStats(params: { partnerId?: string; courtId?: string; fromDate?: string }, format: "excel" | "pdf") {
    const { data } = await api.get<Blob>("/admin/reviews/stats/export", { params: clean({ ...params, format }), responseType: "blob" });
    return data;
  },
  /** Hiding needs a reason (the author is told); showing again takes an optional note. */
  async setReviewStatus(id: string, action: "hide" | "show", reason?: string) {
    const { data } = await api.put<ApiResponse<unknown>>(`/admin/reviews/${id}/${action}`, { reason });
    return data.data;
  },
  async deleteReview(id: string, reason: string) {
    const { data } = await api.delete<ApiResponse<unknown>>(`/admin/reviews/${id}`, { data: { reason } });
    return data.data;
  },
  /** Takes down the court owner's reply (the review stays); the partner is told the reason. */
  async removeReviewReply(id: string, reason: string) {
    const { data } = await api.delete<ApiResponse<unknown>>(`/admin/reviews/${id}/reply`, { data: { reason } });
    return data.data;
  },
  /** Violation reports with how many each status has (under the same search). */
  async reports(params: Record<string, string | number | undefined> = {}) {
    const { data } = await api.get<ApiResponse<Paginated<AdminReport> & { counts: Record<string, number> }>>("/admin/reports", {
      params: clean(params)
    });
    return data.data;
  },
  /** A report with its conversation, the measures the audit log shows and the court's other waiting reports. */
  async reportThread(id: string) {
    const { data } = await api.get<ApiResponse<AdminReportThread>>(`/admin/reports/${id}`);
    return data.data;
  },
  /** Writes to the reporter while the report waits; they are notified and may answer. */
  async sendReportMessage(id: string, content: string) {
    const { data } = await api.post<ApiResponse<ReportThreadEntry>>(`/admin/reports/${id}/messages`, { content });
    return data.data;
  },
  /** Both decisions carry the admin's words to the reporter; resolving also says what was done (measures). */
  async setReportStatus(id: string, action: "resolve" | "reject", payload: ReportDecisionPayload) {
    const { data } = await api.put<ApiResponse<{ id: string; closed: string[] }>>(`/admin/reports/${id}/${action}`, payload);
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
  async voucherDetail(id: string) {
    const { data } = await api.get<ApiResponse<AdminVoucherDetail>>(`/admin/vouchers/${id}`);
    return data.data;
  },
  async createVoucher(payload: AdminVoucherInput) {
    const { data } = await api.post<ApiResponse<AdminVoucherDetail>>("/admin/vouchers", payload);
    return data.data;
  },
  /** A draft takes every term again; an activated voucher only VoucherRunningInput. */
  async updateVoucher(id: string, payload: AdminVoucherInput | VoucherRunningInput) {
    const { data } = await api.put<ApiResponse<AdminVoucherDetail>>(`/admin/vouchers/${id}`, payload);
    return data.data;
  },
  async setVoucherStatus(id: string, action: "activate" | "disable", reason?: string) {
    const { data } = await api.put<ApiResponse<unknown>>(`/admin/vouchers/${id}/${action}`, { reason });
    return data.data;
  },
  /** The moderation queue (public posts only) with how many posts each status has. */
  async pendingBlogs(params: Record<string, string | number | undefined> = {}) {
    const { data } = await api.get<ApiResponse<Paginated<AdminBlog> & { counts: Record<string, number> }>>("/admin/blogs/pending", {
      params: clean(params)
    });
    return data.data;
  },
  /** Rejecting needs a reason (the author is told); approving takes an optional note. */
  async moderateBlog(id: string, action: "approve" | "reject", reason?: string) {
    const { data } = await api.put<ApiResponse<unknown>>(`/admin/blogs/${id}/${action}`, { reason });
    return data.data;
  },
  async hideBlog(id: string, reason: string) {
    const { data } = await api.put<ApiResponse<unknown>>(`/admin/blogs/${id}/hide`, { reason });
    return data.data;
  },
  async blogHistory(id: string) {
    const { data } = await api.get<ApiResponse<ModerationHistoryEntry[]>>(`/admin/blogs/${id}/history`);
    return data.data;
  },
  async blogComments(id: string) {
    const { data } = await api.get<ApiResponse<AdminBlogComment[]>>(`/admin/blogs/${id}/comments`);
    return data.data;
  },
  async removeBlogComment(id: string, commentId: string, reason: string) {
    const { data } = await api.delete<ApiResponse<unknown>>(`/admin/blogs/${id}/comments/${commentId}`, { data: { reason } });
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
  async auditLogFilterOptions() {
    const { data } = await api.get<ApiResponse<{ actions: string[]; entityTypes: string[] }>>("/admin/audit-logs/filter-options");
    return data.data;
  },
  async verifyAuditLogs() {
    const { data } = await api.get<ApiResponse<{ valid: boolean; checked: number; brokenAt?: string | null; headMismatch?: boolean }>>("/admin/audit-logs/verify");
    return data.data;
  },
  async blockchainLogs(params: Record<string, string | number | undefined> = {}) {
    const { data } = await api.get<ApiResponse<Paginated<BlockchainLog>>>("/admin/blockchain-logs", { params: clean(params) });
    return data.data;
  },
  async partnerWallets(params: Record<string, string | number | undefined> = {}) {
    const { data } = await api.get<ApiResponse<Paginated<PartnerWallet>>>("/admin/wallets/partner-wallets", { params: clean(params) });
    return data.data;
  },
  async partnerWalletSummary() {
    const { data } = await api.get<ApiResponse<WalletAdminSummary>>("/admin/wallets/partner-wallets/summary");
    return data.data;
  },
  async partnerWalletDetail(partnerId: string) {
    const { data } = await api.get<ApiResponse<PartnerWallet>>(`/admin/wallets/partner-wallets/${partnerId}`);
    return data.data;
  },
  /** The partner transferred commission debt to the platform account. */
  async recordCommissionDebtPayment(partnerId: string, payload: { amount: number; note?: string }) {
    const { data } = await api.post<ApiResponse<PartnerWallet>>(`/admin/wallets/partner-wallets/${partnerId}/debt-payments`, payload);
    return data.data;
  },
  async settlements(params: Record<string, string | number | undefined> = {}) {
    const { data } = await api.get<ApiResponse<Paginated<Settlement>>>("/admin/settlements", { params: clean(params) });
    return data.data;
  },
  async settlementsSummary(params: Record<string, string | number | undefined> = {}) {
    const { data } = await api.get<ApiResponse<SettlementSummary>>("/admin/settlements/summary", { params: clean(params) });
    return data.data;
  },
  async settleSettlement(id: string) {
    const { data } = await api.put<ApiResponse<Settlement>>(`/admin/settlements/${id}/settle`);
    return data.data;
  },
  /** The partner is told the reason; a settled one takes its net back out of the wallet. */
  async cancelSettlement(id: string, reason: string) {
    const { data } = await api.put<ApiResponse<Settlement>>(`/admin/settlements/${id}/cancel`, { reason });
    return data.data;
  },
  async withdrawals(params: Record<string, string | number | undefined> = {}) {
    const { data } = await api.get<ApiResponse<Paginated<WithdrawalRequest>>>("/admin/withdrawals", { params: clean(params) });
    return data.data;
  },
  async withdrawalsSummary() {
    const { data } = await api.get<ApiResponse<WithdrawalSummary>>("/admin/withdrawals/summary");
    return data.data;
  },
  async approveWithdrawal(id: string) {
    const { data } = await api.put<ApiResponse<WithdrawalRequest>>(`/admin/withdrawals/${id}/approve`);
    return data.data;
  },
  async rejectWithdrawal(id: string, note: string) {
    const { data } = await api.put<ApiResponse<WithdrawalRequest>>(`/admin/withdrawals/${id}/reject`, { note });
    return data.data;
  },
  /** The note is the bank transfer's reference, kept with the request and in the audit log. */
  async payWithdrawal(id: string, note: string) {
    const { data } = await api.put<ApiResponse<WithdrawalRequest>>(`/admin/withdrawals/${id}/paid`, { note });
    return data.data;
  }
};

function clean(params: Record<string, string | number | undefined>) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== "" && value !== undefined));
}
