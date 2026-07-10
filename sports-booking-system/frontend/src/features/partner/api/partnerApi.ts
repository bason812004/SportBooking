import { api } from "../../../lib/axios";
import type {
  ApiResponse,
  Booking,
  Court,
  Paginated,
  PartnerBlog,
  PartnerDashboard,
  PartnerProfile,
  PartnerRevenueReport,
  PartnerTournament,
  PartnerVoucher
} from "../../../types/api";

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
};

export type PartnerCalendar = {
  court: { openingTime: string; closingTime: string };
  items: PartnerCalendarBooking[];
};

export type PartnerVoucherPayload = {
  courtId?: string | null;
  code: string;
  title: string;
  description?: string;
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
  async updateProfile(payload: Omit<PartnerProfile, "id" | "approvalStatus" | "user"> & { fullName: string; phone?: string; avatarUrl?: string }) {
    const { data } = await api.put<ApiResponse<PartnerProfile>>("/partner/profile", payload);
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
  async updateCourt(id: string, payload: Record<string, unknown>) {
    const { data } = await api.put<ApiResponse<Court>>(`/partner/courts/${id}`, payload);
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
  async addCourtImage(courtId: string, image: File, sortOrder = 0) {
    const formData = new FormData();
    formData.append("image", image);
    formData.append("sortOrder", String(sortOrder));
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
    const { data } = await api.get<ApiResponse<Paginated<Booking>>>("/partner/bookings", {
      params: cleanParams
    });
    return data.data;
  },
  async setBookingStatus(id: string, action: "confirm" | "reject" | "complete" | "no-show") {
    const { data } = await api.put<ApiResponse<Booking>>(`/partner/bookings/${id}/${action}`);
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
  async updateVoucher(id: string, payload: PartnerVoucherPayload) {
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
  async submitTournament(id: string) {
    const { data } = await api.put<ApiResponse<PartnerTournament>>(`/partner/tournaments/${id}/submit`);
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
  async deleteRecipient(id: string) {
    const { data } = await api.delete<ApiResponse<{ id: string }>>(`/partner/recipients/${id}`);
    return data.data;
  }
};
