import { api } from "../../../lib/axios";
import type { ApiResponse, Booking, Paginated } from "../../../types/api";

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
  depositPercent: number;
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
  checkedInAt?: string | null;
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
    depositPercent: number;
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

export type RecipientSurfaceAvailabilitySlot = {
  startTime: string;
  endTime: string;
  status: "AVAILABLE" | "BOOKED" | "BLOCKED";
  price: number;
  bookingId?: string | null;
  bookingCode?: string | null;
  bookingStatus?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  blockId?: string | null;
  reason?: string | null;
};

export type RecipientSurfaceAvailability = {
  courtSurfaceId: string;
  date: string;
  openingTime: string;
  closingTime: string;
  slotDurationMinutes: number;
  slots: RecipientSurfaceAvailabilitySlot[];
};

export type RecipientCalendarBooking = {
  id: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  bookingStatus: string;
  paymentStatus: string;
  totalPrice: string;
  courtSurfaceId: string | null;
  courtSurface: { id: string; name: string; code: string } | null;
  user: { fullName: string; phone?: string | null } | null;
};

export type RecipientCalendar = {
  court: { openingTime: string; closingTime: string };
  items: RecipientCalendarBooking[];
};

export type RecipientWalkInBookingPayload = {
  courtSurfaceId: string;
  customerName: string;
  customerPhone: string;
  bookingDate: string;
  startTime: string;
  minutes: number;
  paymentMethod: "CASH" | "BANK_TRANSFER" | "E_WALLET";
  paymentType?: "FULL_PAYMENT" | "DEPOSIT";
  note?: string;
  services?: Array<{ serviceId: string; quantity: number }>;
};

export type RecipientWalkInPayment = {
  id: string;
  provider: string;
  qrCodeUrl?: string | null;
  qrPayload?: string | null;
  paymentReference: string;
  expiresAt: string;
  amount: number;
};

export type RecipientWalkInBookingResult = {
  booking: Booking;
  payment: RecipientWalkInPayment | null;
};

export type RecipientWalkInBookingOrderPayload = {
  customerName: string;
  customerPhone: string;
  slots: Array<{ courtSurfaceId: string; bookingDate: string; startTime: string; minutes: number }>;
  paymentMethod: "CASH" | "BANK_TRANSFER";
  paymentType?: "FULL_PAYMENT" | "DEPOSIT";
  note?: string;
  services?: Array<{ serviceId: string; quantity: number }>;
};

export type RecipientWalkInBookingOrderResult = {
  orderId: string;
  bookings: Booking[];
  payment: RecipientWalkInPayment | null;
};

export type RecipientRecurringBookingPayload = {
  customerName: string;
  customerPhone: string;
  slots: Array<{ courtSurfaceId: string; bookingDate: string; startTime: string; minutes: number }>;
  occurrences: number;
  paymentMethod: "CASH" | "BANK_TRANSFER";
  paymentType?: "FULL_PAYMENT" | "DEPOSIT";
  note?: string;
  services?: Array<{ serviceId: string; quantity: number }>;
};

export type RecipientRecurringBookingResult = {
  series: { id: string }[];
  created: Booking[];
  skipped: { courtSurfaceId: string; date: string; reason: string }[];
  payment: RecipientWalkInPayment | null;
};

export type RecipientCustomerMatch = {
  id: string;
  fullName: string;
  phone: string | null;
  bookingsCount: number;
  lastBookingDate: string | null;
};

export type RecipientCustomerHistoryBooking = {
  id: string;
  bookingCode: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  bookingStatus: string;
  totalPrice: number;
  courtSurface: { name: string; code: string } | null;
};

export type RecipientCustomerHistory = {
  customer: { id: string; fullName: string; phone: string | null };
  bookings: RecipientCustomerHistoryBooking[];
};

export type RecipientPaymentStatus = {
  id: string;
  bookingId: string;
  status: "UNPAID" | "PENDING" | "PROCESSING" | "PAID" | "FAILED" | "EXPIRED" | "CANCELLED" | "PARTIALLY_REFUNDED" | "REFUNDED";
  bookingStatus: string;
  amount: number;
  expiresAt: string;
  paidAt?: string | null;
};

export type RecipientBookingGroup = {
  orderId: string | null;
  bookings: Booking[];
};

export const recipientApi = {
  async dashboard() {
    const { data } = await api.get<ApiResponse<RecipientDashboard>>("/recipient/dashboard");
    return data.data;
  },

  async bookings(params: {
    page?: number;
    limit?: number;
    status?: string;
    fromDate?: string;
    toDate?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }) {
    const { data } = await api.get<ApiResponse<Paginated<RecipientBookingGroup>>>("/recipient/bookings", { params });
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
    const { data } = await api.get<ApiResponse<RecipientCalendar>>("/recipient/calendar", { params });
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

  async surfaceAvailability(courtSurfaceId: string, date: string) {
    const { data } = await api.get<ApiResponse<RecipientSurfaceAvailability>>(`/recipient/court-surfaces/${courtSurfaceId}/availability`, { params: { date } });
    return data.data;
  },

  async lockSlot(courtSurfaceId: string, payload: { bookingDate: string; startTime: string; minutes: number; reason?: string }) {
    const { data } = await api.post<ApiResponse<{ id: string }>>(`/recipient/court-surfaces/${courtSurfaceId}/lock`, payload);
    return data.data;
  },

  async unlockSlot(blockId: string) {
    const { data } = await api.post<ApiResponse<{ id: string }>>(`/recipient/availability-blocks/${blockId}/unlock`);
    return data.data;
  },

  async operations(params?: { date?: string; nowTime?: string }) {
    const { data } = await api.get<ApiResponse<RecipientOperations>>("/recipient/operations", { params });
    return data.data;
  },

  async extendBooking(id: string, minutes: number, targetSurfaceId?: string) {
    const { data } = await api.post<ApiResponse<Booking>>(`/recipient/bookings/${id}/extend`, { minutes, targetSurfaceId });
    return data.data;
  },

  async getExtendOptions(id: string, minutes: number) {
    const { data } = await api.get<ApiResponse<Array<{ id: string; name: string }>>>(`/recipient/bookings/${id}/extend-options`, {
      params: { minutes }
    });
    return data.data;
  },

  async createWalkInBooking(payload: RecipientWalkInBookingPayload) {
    const { data } = await api.post<ApiResponse<RecipientWalkInBookingResult>>("/recipient/operations/walk-in-booking", payload);
    return data.data;
  },

  async createWalkInBookingOrder(payload: RecipientWalkInBookingOrderPayload) {
    const { data } = await api.post<ApiResponse<RecipientWalkInBookingOrderResult>>("/recipient/operations/walk-in-booking-order", payload);
    return data.data;
  },

  async createRecurringWalkInBooking(payload: RecipientRecurringBookingPayload) {
    const { data } = await api.post<ApiResponse<RecipientRecurringBookingResult>>("/recipient/operations/recurring-walk-in-booking", payload);
    return data.data;
  },

  async lookupCustomers(phone: string) {
    const { data } = await api.get<ApiResponse<{ matches: RecipientCustomerMatch[] }>>("/recipient/customers/lookup", { params: { phone } });
    return data.data;
  },

  async customerHistory(customerId: string) {
    const { data } = await api.get<ApiResponse<RecipientCustomerHistory>>(`/recipient/customers/${customerId}/history`);
    return data.data;
  },

  async checkInBooking(id: string) {
    const { data } = await api.post<ApiResponse<Booking & { extraChargeAmount?: number }>>(`/recipient/bookings/${id}/check-in`);
    return data.data;
  },

  async earlyCheckOutBooking(id: string) {
    const { data } = await api.post<ApiResponse<Booking>>(`/recipient/bookings/${id}/early-check-out`);
    return data.data;
  },

  async paymentStatus(paymentId: string) {
    const { data } = await api.get<ApiResponse<RecipientPaymentStatus>>(`/recipient/payments/${paymentId}/status`);
    return data.data;
  },

  async confirmPayment(paymentId: string) {
    const { data } = await api.post<ApiResponse<{ id: string; status: string }>>(`/recipient/payments/${paymentId}/confirm`);
    return data.data;
  }
};
