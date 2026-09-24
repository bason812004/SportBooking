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
  /** Each court owns a separate row (and stock) for the same product name. */
  courtId?: string | null;
  court?: { id: string; name: string } | null;
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
  categorySlug?: string;
  categoryName?: string;
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

/**
 * A partner owns one services row per court for the same product name, so a partner-wide list
 * repeats each name once per court. POS-style pickers sell from a single court and want one tile
 * per product, so they collapse the list with this; stock/pricing screens must not, or they hide
 * the other courts' rows.
 */
export function dedupeServicesByName(services: ServiceItem[] | null | undefined): ServiceItem[] {
  const seenNames = new Set<string>();
  return (services || []).filter((svc) => {
    const key = (svc.name || "").trim().toLowerCase();
    if (!key || seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  });
}

export const serviceApi = {
  async getCategories() {
    const res = await api.get<ApiResponse<ServiceCategory[]>>("/services/categories");
    return res.data.data;
  },

  /**
   * The image is shared by every court's row for this product name, so one upload is enough —
   * the backend copies the url onto the partner's other rows when the service is saved.
   */
  async uploadServiceImage(file: File, onProgress?: (percent: number) => void) {
    const form = new FormData();
    form.append("image", file);
    // DO NOT set Content-Type — Axios must auto-generate the multipart boundary.
    const res = await api.post<ApiResponse<{ url: string; publicId: string }>>("/services/partner/image", form, {
      onUploadProgress: onProgress
        ? (e) => {
            if (e.total) onProgress(Math.round((e.loaded * 100) / e.total));
          }
        : undefined
    });
    return res.data.data;
  },

  async getPartnerServices(params?: { categoryId?: string; search?: string; courtId?: string }) {
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
