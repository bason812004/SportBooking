import { api } from "../../../lib/axios";
import type { ApiResponse } from "../../../types/api";

export interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
}

export interface ServiceInventory {
  id: string;
  serviceId: string;
  quantity: number;
  reservedQuantity: number;
  minimumStock: number;
  unit: string;
  lastPurchasePrice: number;
}

export interface ServiceItem {
  id: string;
  partnerId: string;
  categoryId?: string | null;
  name: string;
  description?: string | null;
  type: "PRODUCT" | "RENTAL_SERVICE";
  sportType?: string | null;
  price: number;
  originalPrice?: number;
  costPrice: number;
  unit: string;
  imageUrl?: string | null;
  status: "ACTIVE" | "INACTIVE";
  trackInventory: boolean;
  isAvailable?: boolean;
  category?: ServiceCategory | null;
  inventory?: ServiceInventory | null;
}

export interface CreateServiceInput {
  categoryId?: string | null;
  name: string;
  description?: string;
  type: "PRODUCT" | "RENTAL_SERVICE";
  sportType?: string | null;
  price: number;
  costPrice?: number;
  unit?: string;
  imageUrl?: string | null;
  trackInventory?: boolean;
  initialStock?: number;
  minimumStock?: number;
}

export const serviceApi = {
  async getCategories() {
    const res = await api.get<ApiResponse<ServiceCategory[]>>("/services/categories");
    return res.data.data;
  },

  async getPartnerServices(params?: { categoryId?: string; search?: string }) {
    const res = await api.get<ApiResponse<ServiceItem[]>>("/services/partner", { params });
    return res.data.data;
  },

  async getCourtServices(courtId: string, categoryId?: string) {
    const res = await api.get<ApiResponse<ServiceItem[]>>(`/services/courts/${courtId}`, { params: { categoryId } });
    return res.data.data;
  },

  async createService(data: CreateServiceInput) {
    const res = await api.post<ApiResponse<ServiceItem>>("/services/partner", data);
    return res.data.data;
  },

  async updateService(id: string, data: Partial<CreateServiceInput> & { status?: "ACTIVE" | "INACTIVE" }) {
    const res = await api.patch<ApiResponse<ServiceItem>>(`/services/partner/${id}`, data);
    return res.data.data;
  },

  async deleteService(id: string) {
    const res = await api.delete<ApiResponse<null>>(`/services/partner/${id}`);
    return res.data.data;
  }
};
