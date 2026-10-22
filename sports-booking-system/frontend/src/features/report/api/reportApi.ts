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
  totalBookings: number;
  cancelledBookings: number;
  cancellationRate: number;
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

function createReportApi(basePath: string) {
  return {
    async overview(range: ReportRange) {
      const { data } = await api.get<ApiResponse<ReportOverview>>(`${basePath}/overview`, { params: range });
      return data.data;
    },
    async revenue(range: ReportRange) {
      const { data } = await api.get<ApiResponse<{ bucket: string; series: ReportRevenuePoint[] }>>(`${basePath}/revenue`, { params: range });
      return data.data;
    },
    async bookings(range: ReportRange) {
      const { data } = await api.get<ApiResponse<ReportBookingRow[]>>(`${basePath}/bookings`, { params: range });
      return data.data;
    },
    async services(range: ReportRange) {
      const { data } = await api.get<ApiResponse<ReportServiceRow[]>>(`${basePath}/services`, { params: range });
      return data.data;
    },
    async exportReport(range: ReportRange, format: "excel" | "pdf") {
      const { data } = await api.get<Blob>(`${basePath}/export`, { params: { ...range, format }, responseType: "blob" });
      return data;
    }
  };
}

export const adminReportApi = createReportApi("/admin/report");
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
