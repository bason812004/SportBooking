import { z } from "zod";

export const createServiceCategorySchema = z.object({
  name: z.string().min(2, "Tên danh mục phải có ít nhất 2 ký tự"),
  description: z.string().optional().nullable()
});

export const createServiceSchema = z.object({
  categoryId: z.string().optional().nullable(),
  name: z.string().min(2, "Tên dịch vụ/sản phẩm ít nhất 2 ký tự"),
  description: z.string().optional().nullable(),
  type: z.enum(["PRODUCT", "RENTAL_SERVICE"]),
  sportType: z.string().optional().nullable(),
  price: z.coerce.number().min(0, "Giá bán không được âm"),
  costPrice: z.coerce.number().min(0, "Giá nhập không được âm").optional().default(0),
  unit: z.string().optional().default("cái"),
  imageUrl: z.string().url().optional().nullable().or(z.literal("")),
  trackInventory: z.boolean().optional().default(true),
  initialStock: z.coerce.number().min(0).optional().default(0),
  minimumStock: z.coerce.number().min(0).optional().default(5)
});

export const updateServiceSchema = createServiceSchema.partial().extend({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional()
});

export const courtServiceOverrideSchema = z.object({
  courtId: z.string(),
  serviceId: z.string(),
  priceOverride: z.coerce.number().min(0).optional().nullable(),
  isAvailable: z.boolean().optional().default(true)
});
