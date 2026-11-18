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
  /** Latest line of the price history (the partner's catalog only): what it was and when. */
  lastPriceChange?: { kind: ServicePriceHistoryKind; changedAt: string } | null;
}

/** INITIAL: the price when recording started; CREATED: the price at creation; CHANGED: a later change. */
export type ServicePriceHistoryKind = "INITIAL" | "CREATED" | "CHANGED";

export interface ServicePriceHistoryEntry {
  id: string;
  kind: ServicePriceHistoryKind;
  oldPrice: number | null;
  newPrice: number;
  oldCostPrice: number | null;
  newCostPrice: number;
  /** Which of the two prices this change moved. */
  priceChanged: boolean;
  costPriceChanged: boolean;
  changedAt: string;
  changedBy: { id: string; fullName: string } | null;
}

export interface ServicePriceHistory {
  service: { id: string; name: string; court: { id: string; name: string } | null };
  /** Newest first. */
  entries: ServicePriceHistoryEntry[];
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
  /** One row, with its own stock, is created per court. */
  courtIds: string[];
  /** On hand at each court; products start at 0 when left out, rental gear left out is not counted. */
  initialStock?: number | null;
  minimumStock?: number;
}

export type UpdateServiceInput = Partial<Omit<CreateServiceInput, "courtIds" | "initialStock">> & {
  status?: "ACTIVE" | "INACTIVE";
  /** Only to place a service that has no court yet. */
  courtId?: string;
};

/** A service nobody used yet is deleted; one with sales or stock history is only taken off sale. */
export type DeleteServiceResult = { deleted: boolean; deactivated: boolean };

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

  /** Returns one row per chosen court. */
  async createService(data: CreateServiceInput) {
    const res = await api.post<ApiResponse<ServiceItem[]>>("/services/partner", data);
    return res.data.data;
  },

  async updateService(id: string, data: UpdateServiceInput) {
    const res = await api.patch<ApiResponse<ServiceItem>>(`/services/partner/${id}`, data);
    return res.data.data;
  },

  async deleteService(id: string) {
    const res = await api.delete<ApiResponse<DeleteServiceResult>>(`/services/partner/${id}`);
    return res.data.data;
  },

  /** When the service's sale and cost prices were set, from what and by whom (partner and their staff). */
  async priceHistory(id: string) {
    const res = await api.get<ApiResponse<ServicePriceHistory>>(`/services/partner/${id}/price-history`);
    return res.data.data;
  }
};
