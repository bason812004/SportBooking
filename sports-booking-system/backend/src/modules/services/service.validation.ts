import { z } from "zod";

// Service and court ids are custom prefixed varchar (e.g. "sv0001", "c0001").
const id = z.string().trim().min(1).max(40);
const blankToNull = (val: unknown) => (typeof val === "string" && val.trim() === "" ? null : val);

export const createServiceCategorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, "Tên danh mục phải có ít nhất 2 ký tự").max(100),
    description: z.preprocess(blankToNull, z.string().trim().max(500).optional().nullable())
  })
});

const serviceFields = {
  categoryId: z.preprocess(
    (val) => (typeof val === "string" && (val.trim() === "" || val === "ALL") ? null : val),
    z.string().optional().nullable()
  ),
  name: z.string().trim().min(2, "Tên dịch vụ/sản phẩm ít nhất 2 ký tự").max(255),
  description: z.preprocess(blankToNull, z.string().trim().max(1000).optional().nullable()),
  type: z.enum(["PRODUCT", "RENTAL_SERVICE"]),
  sportType: z.string().optional().nullable(),
  price: z.coerce.number().min(0, "Giá bán không được âm"),
  costPrice: z.coerce.number().min(0, "Giá nhập không được âm"),
  unit: z.string().trim().min(1).max(20),
  imageUrl: z.preprocess(blankToNull, z.string().optional().nullable()),
  trackInventory: z.boolean(),
  minimumStock: z.coerce.number().int().min(0)
};

export const createServiceSchema = z.object({
  body: z.object({
    ...serviceFields,
    costPrice: serviceFields.costPrice.optional().default(0),
    unit: serviceFields.unit.optional().default("cái"),
    trackInventory: serviceFields.trackInventory.optional().default(true),
    minimumStock: serviceFields.minimumStock.optional().default(5),
    // One row, with its own stock, per court.
    courtIds: z.array(id).min(1, "Chọn ít nhất một sân bán dịch vụ này").max(50),
    // On hand now at each court. Products start at 0 when left out (stock then comes in through Nhập hàng);
    // rental gear left out is not counted, so it is never limited.
    initialStock: z.preprocess(blankToNull, z.coerce.number().int().min(0).max(100000).optional().nullable())
  })
});

export const updateServiceSchema = z.object({
  params: z.object({ id }),
  body: z
    .object(serviceFields)
    .partial()
    .extend({
      status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
      // Only to place a service that has no court yet; a placed service stays on its court.
      courtId: id.optional()
    })
});

export const serviceIdParamsSchema = z.object({
  params: z.object({ id })
});

export const courtServiceOverrideSchema = z.object({
  courtId: z.string(),
  serviceId: z.string(),
  priceOverride: z.coerce.number().min(0).optional().nullable(),
  isAvailable: z.boolean().optional().default(true)
});
