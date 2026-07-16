import { z } from "zod";
import { categoryWriteSchema } from "../categories/category.validation.js";

export const rejectSchema = z.object({
  body: z.object({ reason: z.string().min(3) })
});

const optionalQuery = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => value === "" ? undefined : value, schema.optional());

const sortQueryFields = {
  sortBy: optionalQuery(z.string().trim().max(60)),
  sortOrder: optionalQuery(z.enum(["asc", "desc"]))
};

export const userQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: optionalQuery(z.string().trim().max(160)),
    role: optionalQuery(z.enum(["USER", "PARTNER", "ADMIN"])),
    status: optionalQuery(z.enum(["ACTIVE", "LOCKED"])),
    ...sortQueryFields
  })
});

export const partnerQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: optionalQuery(z.string().trim().max(180)),
    status: optionalQuery(z.enum(["PENDING", "APPROVED", "REJECTED"]))
  })
});

export const listQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: optionalQuery(z.string().trim().max(180)),
    status: optionalQuery(z.string().trim().max(50)),
    ...sortQueryFields
  })
});

export const bookingQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: optionalQuery(z.string().trim().max(180)),
    fromDate: optionalQuery(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    toDate: optionalQuery(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    courtId: optionalQuery(z.string().trim().max(40)),
    partnerId: optionalQuery(z.string().trim().max(40)),
    userId: optionalQuery(z.string().trim().max(40)),
    bookingStatus: optionalQuery(z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"])),
    paymentStatus: optionalQuery(z.enum(["UNPAID", "PAID", "PARTIALLY_REFUNDED", "REFUNDED"])),
    ...sortQueryFields
  })
});

export const bookingAdminUpdateSchema = z.object({
  body: z.object({
    bookingStatus: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
    paymentStatus: z.enum(["UNPAID", "PAID", "PARTIALLY_REFUNDED", "REFUNDED"]).optional(),
    adminNote: z.string().trim().max(2000).optional(),
    cancelReason: z.string().trim().max(500).optional(),
    refundAmount: z.number().min(0).optional(),
    platformRetainedAmount: z.number().min(0).optional(),
    actionNote: z.string().trim().max(1000).optional()
  }).refine(
    (value) => [
      value.bookingStatus,
      value.paymentStatus,
      value.adminNote,
      value.cancelReason,
      value.refundAmount,
      value.platformRetainedAmount
    ].some((item) => item !== undefined && item !== ""),
    "Can cap nhat it nhat mot truong"
  )
});

export const adminCourtQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: optionalQuery(z.string().trim().max(180)),
    partnerId: optionalQuery(z.string().trim().max(40)),
    city: optionalQuery(z.string().trim().max(80)),
    district: optionalQuery(z.string().trim().max(80)),
    approvalStatus: optionalQuery(z.enum(["PENDING", "APPROVED", "REJECTED"])),
    activeStatus: optionalQuery(z.enum(["ACTIVE", "INACTIVE"])),
    verified: optionalQuery(z.enum(["true", "false"])),
    featured: optionalQuery(z.enum(["true", "false"])),
    ...sortQueryFields
  })
});

export const adminCourtUpdateSchema = z.object({
  body: z.object({
    activeStatus: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    verified: z.boolean().optional(),
    featured: z.boolean().optional(),
    adminNote: z.string().trim().max(2000).optional()
  }).refine((value) => Object.values(value).some((item) => item !== undefined), "Can cap nhat it nhat mot truong")
});

export const adminCourtRequestUpdateSchema = z.object({
  body: z.object({
    note: z.string().trim().min(3).max(2000)
  })
});

export const moderationSchema = z.object({
  body: z.object({
    reason: z.string().trim().max(1000).optional()
  })
});

export const categoryCreateSchema = categoryWriteSchema;

export const categoryUpdateSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    slug: z.string().min(2).optional(),
    description: z.string().optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional()
  })
});

export const commissionRateSchema = z.object({
  body: z.object({
    rate: z.number().min(0).max(100).nullable()
  })
});

export const defaultCommissionRateSchema = z.object({
  body: z.object({
    rate: z.number().min(0).max(100)
  })
});

export const commissionReportSchema = z.object({
  query: z.object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional()
  })
});

export const financeTransactionQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    month: optionalQuery(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)),
    search: optionalQuery(z.string().trim().max(180)),
    partnerId: optionalQuery(z.string().trim().max(40)),
    transactionType: optionalQuery(z.enum(["EARNING", "REVERSAL"])),
    eventType: optionalQuery(z.enum(["COMPLETED", "NO_SHOW", "REFUND"])),
    payoutStatus: optionalQuery(z.enum(["PENDING", "PROCESSING", "PAID", "FAILED", "CANCELLED"])),
    ...sortQueryFields
  })
});

export const financeRefundQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    month: optionalQuery(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)),
    search: optionalQuery(z.string().trim().max(180)),
    partnerId: optionalQuery(z.string().trim().max(40)),
    paymentStatus: optionalQuery(z.enum(["PARTIALLY_REFUNDED", "REFUNDED"])),
    ...sortQueryFields
  })
});

export const financeMonthSchema = z.object({
  query: z.object({
    month: optionalQuery(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/))
  })
});

export const payoutUpdateSchema = z.object({
  body: z.object({
    status: z.enum(["PENDING", "PROCESSING", "PAID", "FAILED", "CANCELLED"]),
    note: z.string().trim().max(1000).optional()
  })
});

export const notificationCampaignQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: optionalQuery(z.string().trim().max(180)),
    type: optionalQuery(z.string().trim().max(80)),
    targetType: optionalQuery(z.enum(["ALL", "ROLE", "USER", "PARTNER"]))
  })
});

export const notificationCampaignCreateSchema = z.object({
  body: z.object({
    title: z.string().trim().min(3).max(160),
    content: z.string().trim().min(3).max(4000),
    type: z.enum(["SYSTEM", "APPROVAL", "REJECTION", "FINANCE", "INCIDENT", "COURT_UPDATE_REQUESTED"]),
    targetType: z.enum(["ALL", "ROLE", "USER", "PARTNER"]),
    targetRole: z.enum(["USER", "PARTNER", "ADMIN"]).optional(),
    targetUserId: z.string().trim().max(40).optional(),
    targetPartnerId: z.string().trim().max(40).optional(),
    metadata: z.record(z.unknown()).optional()
  }).superRefine((value, ctx) => {
    if (value.targetType === "ROLE" && !value.targetRole) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["targetRole"], message: "Can chon vai tro nhan thong bao" });
    }
    if (value.targetType === "USER" && !value.targetUserId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["targetUserId"], message: "Can nhap user id" });
    }
    if (value.targetType === "PARTNER" && !value.targetPartnerId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["targetPartnerId"], message: "Can nhap partner id" });
    }
  })
});
