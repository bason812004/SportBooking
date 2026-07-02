import { api } from "../../../lib/axios";
import type { ApiResponse, Category, Court, Paginated } from "../../../types/api";

export type CourtFilters = {
  q?: string;
  keyword?: string;
  sportType?: string;
  city?: string;
  province?: string;
  district?: string;
  categoryId?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
};

export type SportTypeOption = {
  value: string;
  label: string;
  categoryId?: string;
};

export type AvailabilitySlot = {
  startTime: string;
  endTime: string;
  status: "AVAILABLE" | "BOOKED" | "PENDING_PAYMENT" | "BLOCKED" | "MAINTENANCE" | "CLOSED";
  price: number;
  bookingId: string | null;
};

export const courtApi = {
  async list(filters: CourtFilters = {}) {
    const { data } = await api.get<ApiResponse<Paginated<Court>>>("/courts", { params: filters });
    return data.data;
  },
  async detail(id: string) {
    const { data } = await api.get<ApiResponse<Court>>(`/courts/${id}`);
    return data.data;
  },
  async availability(id: string, date: string, courtSurfaceId?: string) {
    const { data } = await api.get<ApiResponse<{
      courtId: string;
      courtSurfaceId?: string | null;
      courtSurfaceName?: string | null;
      date: string;
      openingTime: string;
      closingTime: string;
      slotDurationMinutes: number;
      slots: AvailabilitySlot[];
      bookedSlots: Array<{ id: string; startTime: string; endTime: string }>;
    }>>(
      `/courts/${id}/availability`,
      { params: { date, courtSurfaceId } }
    );
    return data.data;
  },
  async categories() {
    const { data } = await api.get<ApiResponse<Category[]>>("/categories");
    return data.data;
  },
  async sportTypes() {
    const { data } = await api.get<ApiResponse<SportTypeOption[]>>("/sport-types");
    return data.data;
  },
  async reviews(id: string) {
    const { data } = await api.get<ApiResponse<Array<{ id: string; rating: number; comment?: string; user: { fullName: string } }>>>(
      `/courts/${id}/reviews`
    );
    return data.data;
  }
};
