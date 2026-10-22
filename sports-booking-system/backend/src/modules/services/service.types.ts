export type ServiceType = "PRODUCT" | "RENTAL_SERVICE";

export interface CreateServiceCategoryInput {
  name: string;
  description?: string;
}

export interface CreateServiceInput {
  categoryId?: string;
  name: string;
  description?: string;
  type: ServiceType;
  sportType?: string | null;
  price: number;
  costPrice?: number;
  unit?: string;
  imageUrl?: string | null;
  trackInventory?: boolean;
  initialStock?: number;
  minimumStock?: number;
}

export interface UpdateServiceInput {
  categoryId?: string | null;
  name?: string;
  description?: string | null;
  type?: ServiceType;
  sportType?: string | null;
  price?: number;
  costPrice?: number;
  unit?: string;
  imageUrl?: string | null;
  status?: "ACTIVE" | "INACTIVE";
  trackInventory?: boolean;
  minimumStock?: number;
}

export interface CourtServiceOverrideInput {
  courtId: string;
  serviceId: string;
  priceOverride?: number | null;
  isAvailable?: boolean;
}
