import { api } from "../../../lib/axios";
import { repairObject } from "../../../lib/text";
import type { ApiResponse, Category, Court, Paginated } from "../../../types/api";

export type CourtFilters = {
  q?: string;
  keyword?: string;
  sportType?: string;
  city?: string;
  province?: string;
  district?: string;
  categoryId?: string;
  minPrice?: string;
  maxPrice?: string;
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
    return repairObject(data.data);
  },
  async detail(id: string) {
    const { data } = await api.get<ApiResponse<Court>>(`/courts/${id}`);
    return repairObject(data.data);
  },
  async availability(id: string, date: string) {
    const { data } = await api.get<ApiResponse<{
      courtId: string;
      date: string;
      openingTime: string;
      closingTime: string;
      slotDurationMinutes: number;
      slots: AvailabilitySlot[];
      bookedSlots: Array<{ id: string; startTime: string; endTime: string }>;
    }>>(
      `/courts/${id}/availability`,
      { params: { date } }
    );
    return data.data;
  },
  async categories() {
    const { data } = await api.get<ApiResponse<Category[]>>("/categories");
    return repairObject(data.data);
  },
  async sportTypes() {
    const { data } = await api.get<ApiResponse<SportTypeOption[]>>("/sport-types");
    return repairObject(data.data);
  },
  async reviews(id: string) {
    const { data } = await api.get<ApiResponse<Array<{ id: string; rating: number; comment?: string; user: { fullName: string } }>>>(
      `/courts/${id}/reviews`
    );
    return data.data;
  }
};
