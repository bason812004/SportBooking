import { api } from "../../../lib/axios";
import type { ApiResponse } from "../../../types/api";

export interface ReportRevenuePoint {
  period: string;
  grossAmount: number;
  commissionAmount?: number;
  netAmount?: number;
}

export interface ReportBookingRow {
  status: string;
  count: number;
}

export interface ReportServiceRow {
  name: string;
  quantity: number;
  revenue: number;
}

export interface ReportOverview {
  totalRevenue: number;
  totalCommission?: number;
  netRevenue?: number;
  /** Money of bookings not finished yet (settlement ledger), not counted as revenue. */
  pendingRevenue: number;
  pendingCount: number;
  totalBookings: number;
  cancelledBookings: number;
  cancellationRate: number;
  /** Service money of finished bookings that is not in the ledger (sold at the counter): adds to totalRevenue. */
  totalServiceRevenue: number;
  occupancyRate: number;
}

export interface CustomerReportBooking {
  id: string;
  bookingCode: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  refundAmount: number;
  bookingStatus: string;
  paymentStatus: string;
  court: { name: string };
  courtSurface: { name: string } | null;
  bookingVoucher: { voucher: { code: string; title: string } } | null;
  bookingServices: Array<{ quantity: number; totalPrice: number; service: { name: string } | null }>;
}

export interface CustomerReport {
  customer: { id: string; fullName: string; phone: string | null; email: string | null; createdAt: string };
  summary: {
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    noShowBookings: number;
    totalSpent: number;
    totalRefund: number;
  };
  bookings: CustomerReportBooking[];
}

export type ReportRange = { from: string; to: string };
/** Admin only: the partner or court a report is narrowed to (partner and staff reports ignore it). */
export type ReportScopeParams = { partnerId?: string; courtId?: string };
type ReportQuery = ReportRange & ReportScopeParams;

type BreakdownFigures = { grossAmount: number; commissionAmount: number; netAmount: number; pendingAmount: number; bookings: number };
export type PartnerRevenueRow = BreakdownFigures & { partnerId: string; name: string; courtCount: number };
export type CourtRevenueRow = BreakdownFigures & { courtId: string; name: string; partnerId: string; partnerName: string; approvalStatus: string };
/** Revenue per partner and per court of a range, from the same settlement ledger as the overview. */
export interface ReportBreakdown {
  partners: PartnerRevenueRow[];
  courts: CourtRevenueRow[];
}

function createReportApi(basePath: string) {
  return {
    async overview(range: ReportQuery) {
      const { data } = await api.get<ApiResponse<ReportOverview>>(`${basePath}/overview`, { params: range });
      return data.data;
    },
    async revenue(range: ReportQuery) {
      const { data } = await api.get<ApiResponse<{ bucket: string; series: ReportRevenuePoint[] }>>(`${basePath}/revenue`, { params: range });
      return data.data;
    },
    async bookings(range: ReportQuery) {
      const { data } = await api.get<ApiResponse<ReportBookingRow[]>>(`${basePath}/bookings`, { params: range });
      return data.data;
    },
    async services(range: ReportQuery) {
      const { data } = await api.get<ApiResponse<ReportServiceRow[]>>(`${basePath}/services`, { params: range });
      return data.data;
    },
    async exportReport(range: ReportQuery, format: "excel" | "pdf") {
      const { data } = await api.get<Blob>(`${basePath}/export`, { params: { ...range, format }, responseType: "blob" });
      return data;
    }
  };
}

export const adminReportApi = {
  ...createReportApi("/admin/report"),
  async breakdown(range: ReportRange) {
    const { data } = await api.get<ApiResponse<ReportBreakdown>>("/admin/report/breakdown", { params: range });
    return data.data;
  }
};
export const partnerReportApi = createReportApi("/partner/report");
export const recipientReportApi = createReportApi("/recipient/report");

export const adminCustomerReportApi = {
  async get(userId: string) {
    const { data } = await api.get<ApiResponse<CustomerReport>>(`/admin/report/customer/${userId}`);
    return data.data;
  },
  async exportReport(userId: string, format: "excel" | "pdf") {
    const { data } = await api.get<Blob>(`/admin/report/customer/${userId}/export`, { params: { format }, responseType: "blob" });
    return data;
  }
};

export const adminBookingReportApi = {
  async exportReport(bookingId: string, format: "excel" | "pdf") {
    const { data } = await api.get<Blob>(`/admin/report/booking/${bookingId}/export`, { params: { format }, responseType: "blob" });
    return data;
  }
};
