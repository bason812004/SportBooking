import { z } from "zod";
import { INVENTORY_TX_TYPES, PURCHASE_ORDER_INITIAL_STATUSES, PURCHASE_ORDER_STATUSES } from "./inventory.types.js";
import { RENTAL_HISTORY_STATUSES } from "./inventory.history.js";

// Service and court ids are custom prefixed varchar (e.g. "sv0001", "c0001"); suppliers and purchase orders use real uuids.
const id = z.string().trim().min(1).max(40);
const blankToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);
const optionalText = (max: number) =>
  z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), z.string().trim().max(max).optional());
const optionalUuid = z.preprocess(blankToUndefined, z.string().uuid().optional());
const optionalId = z.preprocess(blankToUndefined, id.optional());

export const adjustStockSchema = z.object({
  body: z.object({
    serviceId: id,
    type: z.enum(INVENTORY_TX_TYPES),
    quantity: z.coerce.number().int("Số lượng phải là số nguyên").min(0, "Số lượng không được âm"),
    unitCost: z.coerce.number().min(0, "Giá nhập không được âm").optional(),
    note: optionalText(500)
  })
});

export const createSupplierSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, "Tên nhà cung cấp không được để trống").max(160),
    contactName: optionalText(120),
    phone: optionalText(30),
    email: optionalText(160),
    address: optionalText(500)
  })
});

const purchaseOrderBody = z.object({
  supplierId: optionalUuid,
  note: optionalText(500),
  items: z
    .array(
      z.object({
        serviceId: id,
        quantity: z.coerce.number().int("Số lượng phải là số nguyên").min(1, "Số lượng nhập phải lớn hơn 0"),
        unitCost: z.coerce.number().min(0, "Giá nhập không được âm")
      })
    )
    .min(1, "Đơn nhập hàng phải có ít nhất 1 sản phẩm")
});

export const createPurchaseOrderSchema = z.object({
  body: purchaseOrderBody.extend({
    courtId: optionalId,
    status: z.enum(PURCHASE_ORDER_INITIAL_STATUSES).default("DRAFT")
  })
});

// History lists: a Vietnam day (YYYY-MM-DD), a page and a page size (at most 100 rows).
const day = z.preprocess(blankToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ (YYYY-MM-DD)").optional());
const pageNumber = z.preprocess(blankToUndefined, z.coerce.number().int().min(1).optional());
const pageSize = z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(100).optional());

export const listTransactionsSchema = z.object({
  query: z.object({
    courtId: optionalId,
    type: z.preprocess(blankToUndefined, z.enum(INVENTORY_TX_TYPES).optional()),
    search: optionalText(100),
    from: day,
    to: day,
    page: pageNumber,
    limit: pageSize
  })
});

export const salesHistorySchema = z.object({
  query: z.object({ from: day, to: day, search: optionalText(100), page: pageNumber, limit: pageSize })
});

export const rentalHistorySchema = z.object({
  query: z.object({
    status: z.preprocess(blankToUndefined, z.enum(RENTAL_HISTORY_STATUSES).optional()),
    from: day,
    to: day,
    search: optionalText(100),
    page: pageNumber,
    limit: pageSize
  })
});

export const listPurchaseOrdersSchema = z.object({
  query: z.object({
    courtId: optionalId,
    status: z.preprocess(blankToUndefined, z.enum(PURCHASE_ORDER_STATUSES).optional())
  })
});

export const purchaseOrderIdParams = z.object({
  params: z.object({ id: z.string().uuid() })
});

export const updatePurchaseOrderSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: purchaseOrderBody
});

export const receivePurchaseOrderSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      items: z
        .array(
          z.object({
            itemId: z.string().uuid(),
            receivedQuantity: z.coerce.number().int("Số thực nhận phải là số nguyên").min(0, "Số thực nhận không được âm")
          })
        )
        .optional(),
      note: optionalText(500)
    })
    .default({})
});

export const draftFromSuggestionsSchema = z.object({
  body: z.object({ courtId: optionalId }).default({})
});
