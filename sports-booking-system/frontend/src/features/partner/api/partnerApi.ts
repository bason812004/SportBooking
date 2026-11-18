import { api } from "../../../lib/axios";
import type {
  ApiResponse,
  Booking,
  BookingBill,
  Court,
  DynamicPricingRule,
  DynamicPricingRuleInput,
  ModeratedReview,
  OverdueBooking,
  Paginated,
  ReviewSummary,
  PartnerBlog,
  PartnerDashboard,
  PartnerProfile,
  PartnerRevenueReport,
  PartnerTournament,
  PartnerVoucher,
  VoucherConditionsInput,
  VoucherRunningInput,
  PartnerWallet,
  Settlement,
  SettlementSummary,
  WithdrawalRequest
} from "../../../types/api";

/** How the counter charges play outside the booked hours on one court. */
export type CourtTimeChargePolicy = {
  /** Minutes right before the booked start that are not charged. */
  earlyFreeMinutes: number;
  /** How early play may start; null = no limit, 0 = early check-in not allowed. */
  earlyMaxMinutes: number | null;
  /** % of the hourly court price for the charged early minutes. */
  earlyPricePercent: number;
  /** % of the hourly court price when play is extended. */
  extensionPricePercent: number;
};

export type PartnerCourtSurface = {
  id: string;
  courtId: string;
  code: string;
  name: string;
  capacity?: string | null;
  surface?: string | null;
  size?: string | null;
  imageUrl?: string | null;
  status: "ACTIVE" | "INACTIVE";
  sortOrder: number;
  openingTime?: string | null;
  closingTime?: string | null;
};

/** Venue registration: the venue fields are shared by the courts created for each sport. */
export type PartnerCourtRegistrationInput = {
  name: string;
  description?: string;
  address: string;
  ward: string;
  city: string;
  openingTime: string;
  closingTime: string;
  depositPercent?: number | null;
  sports: Array<{
    categoryId: string;
    surfaces: Array<{ name: string; surface?: string | null; size?: string | null }>;
    /** Expected prices: saved as the court's price rows so the admin sees them before approving. */
    prices?: Array<{ dayType: "WEEKDAY" | "WEEKEND" | "HOLIDAY"; startTime: string; endTime: string; price: number }>;
  }>;
};

export type PartnerCourtBlock = {
  id: string;
  courtId: string;
  courtSurfaceId: string | null;
  courtSurface: { id: string; name: string; code: string } | null;
  blockDate: string;
  startTime: string;
  endTime: string;
  reason?: string | null;
  status: "ACTIVE" | "INACTIVE";
};

export type PartnerSurfaceInput = {
  code: string;
  name: string;
  capacity?: string | null;
  surface?: string | null;
  size?: string | null;
  openingTime?: string | null;
  closingTime?: string | null;
};

export type PartnerSurfaceSlot = {
  startTime: string;
  endTime: string;
  status: "AVAILABLE" | "PENDING_PAYMENT" | "BOOKED" | "BLOCKED";
  /** Null for an hour without a price: it cannot be booked. */
  price: number | null;
  bookingId: string | null;
  blockId: string | null;
};

/** An upcoming booking a pause or a change of hours would touch; its customer is told. */
export type AffectedBooking = {
  id: string;
  bookingCode: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  bookingStatus: string;
  customerName: string;
  customerPhone: string | null;
  surfaceName: string | null;
};

export type PartnerSurfaceGrid = {
  surfaceId: string;
  surfaceName: string;
  code: string;
  status: "ACTIVE" | "INACTIVE";
  operatingHours: { open: string; close: string };
  slots: PartnerSurfaceSlot[];
};

export type PartnerCourtBlockBulkPayload = {
  courtSurfaceId?: string | null;
  startDate: string;
  endDate: string;
  weekdays?: number[];
  startTime: string;
  endTime: string;
  reason?: string;
};

export type PartnerCalendarBooking = {
  id: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  bookingStatus: string;
  paymentStatus: string;
  totalPrice: string;
  courtSurfaceId: string | null;
  courtSurface: { id: string; name: string; code: string } | null;
  court: { id: string; name: string };
  user: { fullName: string; phone?: string | null } | null;
  /** Set when the system finished it; an automatic no-show can be corrected for 7 days. */
  autoFinishedAt?: string | null;
};

export type PartnerCalendar = {
  court: { openingTime: string; closingTime: string };
  items: PartnerCalendarBooking[];
};

export type PartnerBookingGroup = {
  orderId: string | null;
  bookings: Array<Booking & { bill: BookingBill }>;
};

export type PartnerVoucherPayload = VoucherConditionsInput & {
  courtId?: string | null;
  code: string;
  title: string;
  description?: string | null;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  maxDiscountAmount?: number | null;
  minBookingAmount: number;
  usageLimit?: number | null;
  startDate: string;
  endDate: string;
};

export const partnerApi = {
  async dashboard() {
    const { data } = await api.get<ApiResponse<PartnerDashboard>>("/partner/dashboard");
    return data.data;
  },
  async profile() {
    const { data } = await api.get<ApiResponse<PartnerProfile>>("/partner/profile");
    return data.data;
  },
  /** `currentPassword` is required when the bank account (where withdrawals go) changes. */
  async updateProfile(
    payload: Omit<PartnerProfile, "id" | "approvalStatus" | "user" | "latestReview"> & { fullName: string; phone?: string; avatarUrl?: string; currentPassword?: string }
  ) {
    const { data } = await api.put<ApiResponse<PartnerProfile>>("/partner/profile", payload);
    return data.data;
  },
  /** Uploads a verification document (photo or PDF); the returned link is saved with the profile. */
  async uploadProfileDocument(file: File) {
    const form = new FormData();
    form.append("file", file);
    // DO NOT set Content-Type — Axios must auto-generate the multipart boundary.
    const { data } = await api.post<ApiResponse<{ url: string; fileName: string; size: number }>>("/partner/profile/document", form);
    return data.data;
  },
  async courts() {
    const { data } = await api.get<ApiResponse<Court[]>>("/partner/courts");
    return data.data;
  },
  async createCourt(payload: Record<string, unknown>) {
    const { data } = await api.post<ApiResponse<Court>>("/partner/courts", payload);
    return data.data;
  },
  /** One court per sport, each with its declared sub-courts, created in a single transaction. */
  async registerCourts(payload: PartnerCourtRegistrationInput) {
    const { data } = await api.post<ApiResponse<{ courts: Court[] }>>("/partner/courts/register", payload);
    return data.data.courts;
  },
  /** reviewRequired: the change went back to the admin; notifiedBookings: customers told about new hours. */
  async updateCourt(id: string, payload: Record<string, unknown>) {
    const { data } = await api.put<ApiResponse<Court & { reviewRequired?: boolean; notifiedBookings?: number }>>(`/partner/courts/${id}`, payload);
    return data.data;
  },
  async affectedBookings(id: string, params: { surfaceId?: string; openingTime?: string; closingTime?: string } = {}) {
    const { data } = await api.get<ApiResponse<AffectedBooking[]>>(`/partner/courts/${id}/affected-bookings`, { params });
    return data.data;
  },
  async updateCourtStatus(id: string, activeStatus: "ACTIVE" | "INACTIVE") {
    const { data } = await api.put<ApiResponse<Court>>(`/partner/courts/${id}/status`, { activeStatus });
    return data.data;
  },
  async courtDetail(id: string) {
    const { data } = await api.get<ApiResponse<Court>>(`/partner/courts/${id}`);
    return data.data;
  },
  async timeChargePolicy(courtId: string) {
    const { data } = await api.get<ApiResponse<CourtTimeChargePolicy>>(`/partner/courts/${courtId}/time-charge-policy`);
    return data.data;
  },
  /** Saved on its own endpoint, so unlike updateCourt it does not send the court back to admin approval. */
  async updateTimeChargePolicy(courtId: string, payload: CourtTimeChargePolicy) {
    const { data } = await api.put<ApiResponse<CourtTimeChargePolicy>>(`/partner/courts/${courtId}/time-charge-policy`, payload);
    return data.data;
  },
  async addCourtImage(courtId: string, image: File, sortOrder = 0, replaceImageId?: string) {
    const formData = new FormData();
    formData.append("image", image);
    formData.append("sortOrder", String(sortOrder));
    if (replaceImageId) formData.append("replaceImageId", replaceImageId);
    const { data } = await api.post<ApiResponse<unknown>>(
      `/partner/courts/${courtId}/images`,
      formData
    );
    return data.data;
  },
  async deleteCourtImage(imageId: string) {
    const { data } = await api.delete<ApiResponse<{ id: string }>>(`/partner/images/${imageId}`);
    return data.data;
  },
  async reorderCourtImages(courtId: string, imageIds: string[]) {
    const { data } = await api.put<ApiResponse<Court>>(`/partner/courts/${courtId}/images/order`, { imageIds });
    return data.data;
  },
  async addPrice(courtId: string, payload: Record<string, unknown>) {
    const { data } = await api.post<ApiResponse<unknown>>(`/partner/courts/${courtId}/prices`, payload);
    return data.data;
  },
  async updatePrice(id: string, payload: Record<string, unknown>) {
    const { data } = await api.put<ApiResponse<unknown>>(`/partner/prices/${id}`, payload);
    return data.data;
  },
  async deletePrice(id: string) {
    const { data } = await api.delete<ApiResponse<unknown>>(`/partner/prices/${id}`);
    return data.data;
  },
  async addService(courtId: string, payload: Record<string, unknown>) {
    const { data } = await api.post<ApiResponse<unknown>>(`/partner/courts/${courtId}/services`, payload);
    return data.data;
  },
  async updateService(id: string, payload: Record<string, unknown>) {
    const { data } = await api.put<ApiResponse<unknown>>(`/partner/services/${id}`, payload);
    return data.data;
  },
  async deleteService(id: string) {
    const { data } = await api.delete<ApiResponse<unknown>>(`/partner/services/${id}`);
    return data.data;
  },
  async bookings(params: Record<string, string | number | undefined> = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== "" && value !== undefined)
    );
    const { data } = await api.get<ApiResponse<Paginated<PartnerBookingGroup>>>("/partner/bookings", {
      params: cleanParams
    });
    return data.data;
  },
  /** The partner's bookings that are over but still open, with when the system finishes each. */
  async overdueBookings() {
    const { data } = await api.get<ApiResponse<OverdueBooking[]>>("/partner/bookings/overdue");
    return data.data;
  },
  /** Rejecting needs the reason the customer is told. */
  async setBookingStatus(id: string, action: "confirm" | "reject" | "complete" | "no-show", reason?: string) {
    const { data } = await api.put<ApiResponse<Booking>>(`/partner/bookings/${id}/${action}`, action === "reject" ? { reason } : undefined);
    return data.data;
  },
  async revenue(month: string) {
    const { data } = await api.get<ApiResponse<PartnerRevenueReport>>("/partner/statistics/revenue", {
      params: { month }
    });
    return data.data;
  },
  async calendar(params: { fromDate: string; toDate: string; courtId: string }) {
    const { data } = await api.get<ApiResponse<PartnerCalendar>>("/partner/calendar", { params });
    return data.data;
  },
  async courtSurfaces(courtId: string) {
    const { data } = await api.get<ApiResponse<PartnerCourtSurface[]>>(`/partner/courts/${courtId}/surfaces`);
    return data.data;
  },
  async updateCourtSurfaceStatus(courtId: string, surfaceId: string, status: "ACTIVE" | "INACTIVE") {
    const { data } = await api.put<ApiResponse<PartnerCourtSurface>>(`/partner/courts/${courtId}/surfaces/${surfaceId}/status`, { status });
    return data.data;
  },
  async createCourtSurface(courtId: string, payload: PartnerSurfaceInput) {
    const { data } = await api.post<ApiResponse<PartnerCourtSurface>>(`/partner/courts/${courtId}/surfaces`, payload);
    return data.data;
  },
  async deleteCourtSurface(courtId: string, surfaceId: string) {
    const { data } = await api.delete<ApiResponse<{ id: string }>>(`/partner/courts/${courtId}/surfaces/${surfaceId}`);
    return data.data;
  },
  async updateCourtSurface(courtId: string, surfaceId: string, payload: Partial<PartnerSurfaceInput>) {
    const { data } = await api.put<ApiResponse<PartnerCourtSurface>>(`/partner/courts/${courtId}/surfaces/${surfaceId}`, payload);
    return data.data;
  },
  async courtBlocks(courtId: string) {
    const { data } = await api.get<ApiResponse<PartnerCourtBlock[]>>(`/partner/courts/${courtId}/blocks`);
    return data.data;
  },
  async createCourtBlock(courtId: string, payload: { courtSurfaceId?: string | null; blockDate: string; startTime: string; endTime: string; reason?: string }) {
    const { data } = await api.post<ApiResponse<PartnerCourtBlock>>(`/partner/courts/${courtId}/blocks`, payload);
    return data.data;
  },
  async cancelCourtBlock(courtId: string, blockId: string) {
    const { data } = await api.delete<ApiResponse<PartnerCourtBlock>>(`/partner/courts/${courtId}/blocks/${blockId}`);
    return data.data;
  },
  async courtAvailabilityGrid(courtId: string, date: string) {
    const { data } = await api.get<ApiResponse<PartnerSurfaceGrid[]>>(`/partner/courts/${courtId}/availability-grid`, { params: { date } });
    return data.data;
  },
  async createCourtBlockBulk(courtId: string, payload: PartnerCourtBlockBulkPayload) {
    const { data } = await api.post<ApiResponse<{ created: number }>>(`/partner/courts/${courtId}/blocks/bulk`, payload);
    return data.data;
  },
  async vouchers() {
    const { data } = await api.get<ApiResponse<PartnerVoucher[]>>("/partner/vouchers");
    return data.data;
  },
  async voucherDetail(id: string) {
    const { data } = await api.get<ApiResponse<PartnerVoucher>>(`/partner/vouchers/${id}`);
    return data.data;
  },
  async createVoucher(payload: PartnerVoucherPayload) {
    const { data } = await api.post<ApiResponse<PartnerVoucher>>("/partner/vouchers", payload);
    return data.data;
  },
  /** A draft takes every term again; an activated voucher only VoucherRunningInput. */
  async updateVoucher(id: string, payload: PartnerVoucherPayload | VoucherRunningInput) {
    const { data } = await api.put<ApiResponse<PartnerVoucher>>(`/partner/vouchers/${id}`, payload);
    return data.data;
  },
  async activateVoucher(id: string) {
    const { data } = await api.put<ApiResponse<PartnerVoucher>>(`/partner/vouchers/${id}/activate`);
    return data.data;
  },
  async disableVoucher(id: string) {
    const { data } = await api.put<ApiResponse<PartnerVoucher>>(`/partner/vouchers/${id}/disable`);
    return data.data;
  },
  async deleteVoucher(id: string) {
    const { data } = await api.delete<ApiResponse<{ id: string }>>(`/partner/vouchers/${id}`);
    return data.data;
  },
  async pricingRules() {
    const { data } = await api.get<ApiResponse<DynamicPricingRule[]>>("/partner/dynamic-pricing/rules");
    return data.data;
  },
  async pricingRuleDetail(id: string) {
    const { data } = await api.get<ApiResponse<DynamicPricingRule>>(`/partner/dynamic-pricing/rules/${id}`);
    return data.data;
  },
  async createPricingRule(payload: DynamicPricingRuleInput) {
    const { data } = await api.post<ApiResponse<DynamicPricingRule>>("/partner/dynamic-pricing/rules", payload);
    return data.data;
  },
  async updatePricingRule(id: string, payload: DynamicPricingRuleInput) {
    const { data } = await api.put<ApiResponse<DynamicPricingRule>>(`/partner/dynamic-pricing/rules/${id}`, payload);
    return data.data;
  },
  async activatePricingRule(id: string) {
    const { data } = await api.put<ApiResponse<DynamicPricingRule>>(`/partner/dynamic-pricing/rules/${id}/activate`);
    return data.data;
  },
  async deactivatePricingRule(id: string) {
    const { data } = await api.put<ApiResponse<DynamicPricingRule>>(`/partner/dynamic-pricing/rules/${id}/deactivate`);
    return data.data;
  },
  async deletePricingRule(id: string) {
    const { data } = await api.delete<ApiResponse<{ id: string }>>(`/partner/dynamic-pricing/rules/${id}`);
    return data.data;
  },
  /** Writes or rewrites the court owner's public reply to a review. */
  async replyReview(id: string, reply: string) {
    const { data } = await api.put<ApiResponse<{ id: string; reply: string }>>(`/partner/reviews/${id}/reply`, { reply });
    return data.data;
  },
  async deleteReviewReply(id: string) {
    const { data } = await api.delete<ApiResponse<{ id: string; reply: null }>>(`/partner/reviews/${id}/reply`);
    return data.data;
  },
  async reviews(params: { page?: number; limit?: number; courtId?: string; status?: string; rating?: string; search?: string; replied?: string } = {}) {
    const { data } = await api.get<ApiResponse<Paginated<ModeratedReview> & { summary: ReviewSummary }>>("/partner/reviews", {
      // Empty filters are left out rather than sent as "".
      params: Object.fromEntries(Object.entries(params).filter(([, value]) => value !== "" && value !== undefined))
    });
    return data.data;
  },
  async blogs() {
    const { data } = await api.get<ApiResponse<PartnerBlog[]>>("/partner/blogs");
    return data.data;
  },
  async blogDetail(id: string) {
    const { data } = await api.get<ApiResponse<PartnerBlog>>(`/partner/blogs/${id}`);
    return data.data;
  },
  async createBlog(payload: Record<string, unknown>) {
    const { data } = await api.post<ApiResponse<PartnerBlog>>("/partner/blogs", payload);
    return data.data;
  },
  async updateBlog(id: string, payload: Record<string, unknown>) {
    const { data } = await api.put<ApiResponse<PartnerBlog>>(`/partner/blogs/${id}`, payload);
    return data.data;
  },
  async updateBlogComments(id: string, allowComments: boolean) {
    const { data } = await api.patch<ApiResponse<PartnerBlog>>(`/partner/blogs/${id}/comments`, { allowComments });
    return data.data;
  },
  async submitBlog(id: string) {
    const { data } = await api.put<ApiResponse<PartnerBlog>>(`/partner/blogs/${id}/submit`);
    return data.data;
  },
  async deleteBlog(id: string) {
    const { data } = await api.delete<ApiResponse<{ id: string }>>(`/partner/blogs/${id}`);
    return data.data;
  },
  async tournaments() {
    const { data } = await api.get<ApiResponse<PartnerTournament[]>>("/partner/tournaments");
    return data.data;
  },
  async tournamentDetail(id: string) {
    const { data } = await api.get<ApiResponse<PartnerTournament>>(`/partner/tournaments/${id}`);
    return data.data;
  },
  async createTournament(payload: Record<string, unknown>) {
    const { data } = await api.post<ApiResponse<PartnerTournament>>("/partner/tournaments", payload);
    return data.data;
  },
  async updateTournament(id: string, payload: Record<string, unknown>) {
    const { data } = await api.put<ApiResponse<PartnerTournament>>(`/partner/tournaments/${id}`, payload);
    return data.data;
  },
  async deleteTournament(id: string) {
    const { data } = await api.delete<ApiResponse<{ id: string }>>(`/partner/tournaments/${id}`);
    return data.data;
  },
  async listRecipients() {
    const { data } = await api.get<ApiResponse<any[]>>("/partner/recipients");
    return data.data;
  },
  async createRecipient(payload: Record<string, unknown>) {
    const { data } = await api.post<ApiResponse<any>>("/partner/recipients", payload);
    return data.data;
  },
  async updateRecipient(id: string, payload: Record<string, unknown>) {
    const { data } = await api.put<ApiResponse<any>>(`/partner/recipients/${id}`, payload);
    return data.data;
  },
  /** A staff account that never did anything is deleted; one with history is locked instead. */
  async deleteRecipient(id: string) {
    const { data } = await api.delete<ApiResponse<{ id: string; deleted: boolean; locked: boolean }>>(`/partner/recipients/${id}`);
    return data.data;
  },
  /** LOCKED signs the staff member out at once and stops them signing in; ACTIVE opens the account again. */
  async setRecipientStatus(id: string, status: "ACTIVE" | "LOCKED") {
    const { data } = await api.put<ApiResponse<any>>(`/partner/recipients/${id}/status`, { status });
    return data.data;
  },
  async myWallet() {
    const { data } = await api.get<ApiResponse<PartnerWallet>>("/partner/wallet/me");
    return data.data;
  },
  async mySettlements(params: Record<string, string | number | undefined> = {}) {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== "")
    );
    const { data } = await api.get<ApiResponse<Paginated<Settlement>>>("/partner/settlements", { params: cleaned });
    return data.data;
  },
  async settlementSummary() {
    const { data } = await api.get<ApiResponse<SettlementSummary>>("/partner/settlements/summary");
    return data.data;
  },
  async settlementDetail(id: string) {
    const { data } = await api.get<ApiResponse<Settlement>>(`/partner/settlements/${id}`);
    return data.data;
  },
  async myWithdrawals(params: Record<string, string | number | undefined> = {}) {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== "")
    );
    const { data } = await api.get<ApiResponse<Paginated<WithdrawalRequest>>>("/partner/withdrawals", { params: cleaned });
    return data.data;
  },
  /** The money goes to the bank account saved in the profile (Cài đặt); the request carries only the amount. */
  async createWithdrawal(payload: { amount: number }) {
    const { data } = await api.post<ApiResponse<WithdrawalRequest>>("/partner/withdrawals", payload);
    return data.data;
  },
  /** Takes back a request no admin has handled yet; the amount returns to the available balance. */
  async cancelWithdrawal(id: string) {
    const { data } = await api.put<ApiResponse<WithdrawalRequest>>(`/partner/withdrawals/${id}/cancel`);
    return data.data;
  }
};
