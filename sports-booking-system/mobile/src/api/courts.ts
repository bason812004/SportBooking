import { api, cleanParams } from "./client";
import type { ApiResponse, AvailabilitySlot, Category, Court, Paginated } from "./types";

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

export type SportTypeOption = { value: string; label: string; categoryId?: string; code?: string };

export const courtApi = {
  async list(filters: CourtFilters = {}) {
    const { data } = await api.get<ApiResponse<Paginated<Court>>>("/courts", { params: cleanParams(filters) });
    return data.data;
  },
  async detail(id: string) {
    const { data } = await api.get<ApiResponse<Court>>(`/courts/${id}`);
    return data.data;
  },
  async availability(id: string, date: string) {
    const { data } = await api.get<ApiResponse<{ courtId: string; date: string; openingTime: string; closingTime: string; slotDurationMinutes: number; slots: AvailabilitySlot[] }>>(
      `/courts/${id}/availability`,
      { params: { date } }
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
    const { data } = await api.get<ApiResponse<NonNullable<Court["reviews"]>>>(`/courts/${id}/reviews`);
    return data.data;
  }
};

