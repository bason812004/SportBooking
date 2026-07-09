import { api } from "../../../lib/axios";
import type { ApiResponse, Booking, Paginated } from "../../../types/api";

export type RecipientCourtSurface = {
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

export type RecipientOperationBooking = {
  id: string;
  bookingCode: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  startTime: string;
  endTime: string;
  bookingStatus: string;
  paymentStatus: string;
  totalPrice: number;
};

export type RecipientOperationItem = {
  surface: {
    id: string;
    code: string;
    name: string;
    capacity?: string | null;
    surface?: string | null;
    size?: string | null;
    imageUrl?: string | null;
    status: "ACTIVE" | "INACTIVE";
  };
  status: "AVAILABLE" | "OCCUPIED" | "ENDING_SOON" | "OVERDUE" | "RESERVED_SOON" | "INACTIVE";
  minutesLeft: number | null;
  currentBooking: RecipientOperationBooking | null;
  latestEndedBooking: RecipientOperationBooking | null;
  nextBooking: RecipientOperationBooking | null;
  canExtend: boolean;
};

export type RecipientOperations = {
  court: { id: string; name: string };
  date: string;
  nowTime: string;
  summary: {
    total: number;
    available: number;
    occupied: number;
    endingSoon: number;
    overdue: number;
    reservedSoon: number;
  };
  items: RecipientOperationItem[];
};

export type RecipientWalkInBookingPayload = {
  courtSurfaceId: string;
  customerName: string;
  customerPhone: string;
  bookingDate: string;
  startTime: string;
  minutes: number;
  paymentMethod: "CASH" | "BANK_TRANSFER" | "E_WALLET";
  note?: string;
};

export type RecipientDashboard = {
  courtName: string;
  bookingsToday: number;
  pendingBookings: number;
  revenue: number;
  recentBookings: Array<{
    id: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
    totalPrice: number;
    bookingStatus: string;
    user: {
      fullName: string;
      email: string;
    };
    courtSurface?: { id: string; name: string; code: string } | null;
  }>;
};

export type RecipientCourtSurface = {
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

export type RecipientOperationBooking = {
  id: string;
  bookingCode: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  startTime: string;
  endTime: string;
  bookingStatus: string;
  paymentStatus: string;
  totalPrice: number;
};

export type RecipientOperationItem = {
  surface: {
    id: string;
    code: string;
    name: string;
    capacity?: string | null;
    surface?: string | null;
    size?: string | null;
    imageUrl?: string | null;
    status: "ACTIVE" | "INACTIVE";
  };
  status: "AVAILABLE" | "OCCUPIED" | "ENDING_SOON" | "OVERDUE" | "RESERVED_SOON" | "INACTIVE";
  minutesLeft: number | null;
  currentBooking: RecipientOperationBooking | null;
  latestEndedBooking: RecipientOperationBooking | null;
  nextBooking: RecipientOperationBooking | null;
  canExtend: boolean;
};

export type RecipientOperations = {
  court: { id: string; name: string };
  date: string;
  nowTime: string;
  summary: {
    total: number;
    available: number;
    occupied: number;
    endingSoon: number;
    overdue: number;
    reservedSoon: number;
  };
  items: RecipientOperationItem[];
};

export type RecipientWalkInBookingPayload = {
  courtSurfaceId: string;
  customerName: string;
  customerPhone: string;
  bookingDate: string;
  startTime: string;
  minutes: number;
  paymentMethod: "CASH" | "BANK_TRANSFER" | "E_WALLET";
  note?: string;
};

export const recipientApi = {
  async dashboard() {
    const { data } = await api.get<ApiResponse<RecipientDashboard>>("/recipient/dashboard");
    return data.data;
  },

  async bookings(params: { page?: number; limit?: number; status?: string; fromDate?: string; toDate?: string }) {
    const { data } = await api.get<ApiResponse<Paginated<Booking>>>("/recipient/bookings", { params });
    return data.data;
  },

  async confirmBooking(id: string) {
    const { data } = await api.put<ApiResponse<Booking>>(`/recipient/bookings/${id}/confirm`);
    return data.data;
  },

  async rejectBooking(id: string) {
    const { data } = await api.put<ApiResponse<Booking>>(`/recipient/bookings/${id}/reject`);
    return data.data;
  },

  async completeBooking(id: string) {
    const { data } = await api.put<ApiResponse<Booking>>(`/recipient/bookings/${id}/complete`);
    return data.data;
  },

  async noShowBooking(id: string) {
    const { data } = await api.put<ApiResponse<Booking>>(`/recipient/bookings/${id}/no-show`);
    return data.data;
  },

  async calendar(params: { fromDate: string; toDate: string }) {
    const { data } = await api.get<ApiResponse<any[]>>("/recipient/calendar", { params });
    return data.data;
  },

  async courtSurfaces() {
    const { data } = await api.get<ApiResponse<RecipientCourtSurface[]>>("/recipient/court-surfaces");
    return data.data;
  },

  async updateCourtSurfaceStatus(id: string, status: "ACTIVE" | "INACTIVE") {
    const { data } = await api.put<ApiResponse<RecipientCourtSurface>>(`/recipient/court-surfaces/${id}/status`, { status });
    return data.data;
  },

  async operations(params?: { date?: string; nowTime?: string }) {
    const { data } = await api.get<ApiResponse<RecipientOperations>>("/recipient/operations", { params });
    return data.data;
  },

  async extendBooking(id: string, minutes: number) {
    const { data } = await api.post<ApiResponse<Booking>>(`/recipient/bookings/${id}/extend`, { minutes });
    return data.data;
  },

  async createWalkInBooking(payload: RecipientWalkInBookingPayload) {
    const { data } = await api.post<ApiResponse<Booking>>("/recipient/operations/walk-in-booking", payload);
    return data.data;
  },

  async earlyCheckInBooking(id: string) {
    const { data } = await api.post<ApiResponse<Booking>>(`/recipient/bookings/${id}/early-check-in`);
    return data.data;
  },

  async earlyCheckOutBooking(id: string) {
    const { data } = await api.post<ApiResponse<Booking>>(`/recipient/bookings/${id}/early-check-out`);
    return data.data;
  }
};
