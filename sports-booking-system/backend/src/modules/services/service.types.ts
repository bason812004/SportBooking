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
  /** One row, with its own stock, per court. */
  courtIds: string[];
  /** On hand at each court; products start at 0 when left out, rental gear left out is not counted. */
  initialStock?: number | null;
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
  /** Only to place a service that has no court yet. */
  courtId?: string;
}

export type ServiceViewer = { id: string; role: string } | undefined;

export interface CourtServiceOverrideInput {
  courtId: string;
  serviceId: string;
  priceOverride?: number | null;
  isAvailable?: boolean;
}
