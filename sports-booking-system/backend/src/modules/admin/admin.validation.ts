import { AccountStatus, BookingStatus, PaymentStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { REPORT_MEASURE_CODES } from "../reports/report.thread.js";
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
    // Every role and status the database can hold, so no filter the page offers is rejected.
    role: optionalQuery(z.nativeEnum(UserRole)),
    status: optionalQuery(z.nativeEnum(AccountStatus)),
    ...sortQueryFields
  })
});

export const lockUserSchema = z.object({
  body: z.object({
    reason: z.string().trim().max(500, "Ly do toi da 500 ky tu").optional()
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

const exportFormat = z.enum(["excel", "pdf"]);

/** The commission page as a file: every partner's rate and the change history, nothing to filter. */
export const commissionExportQuerySchema = z.object({
  query: z.object({ format: exportFormat })
});

// Exports take the list's own filters (every page of it). Customers are always role USER, so no role filter here.
export const customerExportQuerySchema = z.object({
  query: z.object({
    search: optionalQuery(z.string().trim().max(160)),
    status: optionalQuery(z.nativeEnum(AccountStatus)),
    format: exportFormat
  })
});

export const partnerExportQuerySchema = z.object({
  query: z.object({
    search: optionalQuery(z.string().trim().max(180)),
    status: optionalQuery(z.enum(["PENDING", "APPROVED", "REJECTED"])),
    format: exportFormat
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

export const reportListQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: optionalQuery(z.string().trim().max(180)),
    status: optionalQuery(z.enum(["PENDING", "RESOLVED", "REJECTED"]))
  })
});

const reportIdParams = z.object({ id: z.string().trim().min(1).max(40) });

export const reportThreadSchema = z.object({ params: reportIdParams });

export const reportMessageSchema = z.object({
  params: reportIdParams,
  body: z.object({ content: z.string().trim().min(1, "Nhập nội dung tin nhắn").max(2000, "Tin nhắn tối đa 2000 ký tự") })
});

/**
 * Both decisions tell the reporter in the admin's words. Resolving also says what was done: audit entries the system
 * found on the court (auditIds, checked again by the service) and measures taken outside the system.
 */
export const reportResolveSchema = z.object({
  params: reportIdParams,
  body: z.object({
    note: z.string().trim().min(10, "Viết phản hồi cho người báo cáo (ít nhất 10 ký tự)").max(2000, "Phản hồi tối đa 2000 ký tự"),
    measures: z.array(z.enum(REPORT_MEASURE_CODES)).max(REPORT_MEASURE_CODES.length).optional(),
    auditIds: z.array(z.string().uuid()).max(50).optional(),
    applyToCourtPending: z.boolean().optional()
  })
});

export const reportRejectSchema = z.object({
  params: reportIdParams,
  body: z.object({
    note: z.string().trim().min(3, "Nhập lý do (ít nhất 3 ký tự)").max(2000, "Lý do tối đa 2000 ký tự"),
    applyToCourtPending: z.boolean().optional()
  })
});

const dayQuery = optionalQuery(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải có dạng YYYY-MM-DD"));

export const auditLogQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: optionalQuery(z.string().trim().max(180)),
    action: optionalQuery(z.string().trim().max(100)),
    entityType: optionalQuery(z.string().trim().max(80)),
    actorRole: optionalQuery(z.enum(["ADMIN", "PARTNER", "RECIPIENT", "USER", "SYSTEM"])),
    fromDate: dayQuery,
    toDate: dayQuery,
    ...sortQueryFields
  })
});

export const reviewListQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: optionalQuery(z.string().trim().max(180)),
    status: optionalQuery(z.enum(["VISIBLE", "HIDDEN"])),
    rating: optionalQuery(z.coerce.number().int().min(1).max(5)),
    partnerId: optionalQuery(z.string().trim().max(40)),
    courtId: optionalQuery(z.string().trim().max(40)),
    fromDate: dayQuery,
    toDate: dayQuery
  })
});

/** The statistics above the review list: one partner, one court and a period; the list's other filters do not apply. */
export const reviewStatsQuerySchema = z.object({
  query: z.object({
    partnerId: optionalQuery(z.string().trim().max(40)),
    courtId: optionalQuery(z.string().trim().max(40)),
    fromDate: dayQuery,
    toDate: dayQuery
  })
});

export const reviewStatsExportQuerySchema = z.object({
  query: reviewStatsQuerySchema.shape.query.extend({ format: exportFormat })
});

/** Hiding or deleting a review tells its author why, so the reason is required; showing it again takes an optional note. */
export const reviewDecisionSchema = z.object({
  params: z.object({ id: z.string().trim().min(1).max(40) }),
  body: z.object({ reason: z.string().trim().min(3, "Nhập lý do (ít nhất 3 ký tự)").max(1000) })
});

export const reviewRestoreSchema = z.object({
  params: z.object({ id: z.string().trim().min(1).max(40) }),
  body: z.object({ reason: z.string().trim().max(1000).optional() })
});

/** The moderation queue: public posts only (private ones are the author's own and skip review). */
export const blogModerationQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: optionalQuery(z.string().trim().max(180)),
    status: optionalQuery(z.enum(["PENDING", "PUBLISHED", "REJECTED", "HIDDEN", "ALL"])),
    authorRole: optionalQuery(z.enum(["USER", "PARTNER"]))
  })
});

const blogIdParams = z.object({ id: z.string().trim().min(1).max(40) });

export const blogIdParamsSchema = z.object({ params: blogIdParams });

/** Rejecting or hiding a post tells its author why, so the reason is required. */
export const blogDecisionSchema = z.object({
  params: blogIdParams,
  body: z.object({ reason: z.string().trim().min(3, "Nhập lý do (ít nhất 3 ký tự)").max(1000) })
});

export const blogApproveSchema = z.object({
  params: blogIdParams,
  body: z.object({ reason: z.string().trim().max(1000).optional() })
});

export const blogCommentRemovalSchema = z.object({
  params: blogIdParams.extend({ commentId: z.string().trim().min(1).max(40) }),
  body: z.object({ reason: z.string().trim().min(3, "Nhập lý do (ít nhất 3 ký tự)").max(1000) })
});

/** The status filter matches the status the list shows, EXPIRED included (an active voucher past its end date). */
export const voucherListQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: optionalQuery(z.string().trim().max(180)),
    status: optionalQuery(z.enum(["DRAFT", "ACTIVE", "EXPIRED", "DISABLED"]))
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
    // Every status the database can hold, so any booking can be filtered; see admin.bookingUpdate.ts for what admins may set.
    bookingStatus: optionalQuery(z.nativeEnum(BookingStatus)),
    paymentStatus: optionalQuery(z.nativeEnum(PaymentStatus)),
    ...sortQueryFields
  })
});

export const bookingAdminUpdateSchema = z.object({
  body: z.object({
    bookingStatus: z.nativeEnum(BookingStatus).optional(),
    paymentStatus: z.nativeEnum(PaymentStatus).optional(),
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
    ].some((item) => item !== undefined),
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
    /** Locking a court tells the partner why; they cannot reopen it themselves. */
    lockReason: z.string().trim().min(3, "Nhập lý do khoá sân (ít nhất 3 ký tự)").max(1000).optional(),
    verified: z.boolean().optional(),
    featured: z.boolean().optional(),
    adminNote: z.string().trim().max(2000).optional()
  })
    .refine((value) => Object.values(value).some((item) => item !== undefined), "Can cap nhat it nhat mot truong")
    .refine((value) => value.activeStatus !== "INACTIVE" || Boolean(value.lockReason), { message: "Nhập lý do khoá sân", path: ["lockReason"] })
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
    name: z.string().trim().min(2, "Ten danh muc can it nhat 2 ky tu").max(100, "Ten danh muc toi da 100 ky tu").optional(),
    slug: z.string().min(2).optional(),
    description: z.string().trim().max(500, "Mo ta toi da 500 ky tu").optional(),
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
    transactionType: optionalQuery(z.enum(["EARNING", "ADJUSTMENT", "REVERSAL"])),
    eventType: optionalQuery(z.enum(["COMPLETED", "NO_SHOW", "REFUND"])),
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

/**
 * Types an admin sends by hand. Approvals, rejections and court update requests come from their own workflows
 * (with the court or profile attached), so a hand-written one would only imitate them.
 */
const CAMPAIGN_TYPES = ["SYSTEM", "FINANCE", "INCIDENT", "MAINTENANCE", "PROMOTION"] as const;
const CAMPAIGN_ROLES = ["USER", "PARTNER", "RECIPIENT", "ADMIN"] as const;

/**
 * Who a campaign goes to: every account, one role, one account or one partner. Counted the same way before sending.
 * Accounts picked one by one (USERS) are sent, not counted beforehand: the admin already sees how many were picked.
 */
const campaignAudience = {
  targetType: z.enum(["ALL", "ROLE", "USER", "PARTNER"]),
  targetRole: optionalQuery(z.enum(CAMPAIGN_ROLES)),
  targetUserId: optionalQuery(z.string().trim().max(40)),
  targetPartnerId: optionalQuery(z.string().trim().max(40))
};
const MAX_PICKED_RECIPIENTS = 1000;

function requireAudienceTarget(
  value: { targetType: string; targetRole?: string; targetUserId?: string; targetPartnerId?: string; targetUserIds?: string[] },
  ctx: z.RefinementCtx
) {
  if (value.targetType === "USERS" && !value.targetUserIds?.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["targetUserIds"], message: "Chọn các tài khoản nhận thông báo" });
  }
  if (value.targetType === "ROLE" && !value.targetRole) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["targetRole"], message: "Chọn vai trò nhận thông báo" });
  }
  if (value.targetType === "USER" && !value.targetUserId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["targetUserId"], message: "Chọn tài khoản nhận thông báo" });
  }
  if (value.targetType === "PARTNER" && !value.targetPartnerId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["targetPartnerId"], message: "Chọn đối tác nhận thông báo" });
  }
}

export const notificationCampaignQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: optionalQuery(z.string().trim().max(180)),
    type: optionalQuery(z.string().trim().max(80)),
    targetType: optionalQuery(z.enum(["ALL", "ROLE", "USER", "PARTNER", "USERS"])),
    targetRole: optionalQuery(z.enum(CAMPAIGN_ROLES))
  })
});

export const notificationCampaignCreateSchema = z.object({
  body: z.object({
    title: z.string().trim().min(3, "Tiêu đề có ít nhất 3 ký tự").max(160, "Tiêu đề tối đa 160 ký tự"),
    content: z.string().trim().min(3, "Nội dung có ít nhất 3 ký tự").max(4000, "Nội dung tối đa 4000 ký tự"),
    type: z.enum(CAMPAIGN_TYPES),
    ...campaignAudience,
    targetType: z.enum(["ALL", "ROLE", "USER", "PARTNER", "USERS"]),
    targetUserIds: z
      .array(z.string().trim().min(1).max(40))
      .max(MAX_PICKED_RECIPIENTS, `Chọn tối đa ${MAX_PICKED_RECIPIENTS} tài khoản; nhiều hơn hãy gửi cho cả nhóm`)
      .optional(),
    metadata: z.record(z.unknown()).optional()
  }).superRefine(requireAudienceTarget)
});

/** The groups the recipient picker shows: accounts by role, a partner's owner and staff, or a court's customers. */
export const notificationRecipientGroupsSchema = z.object({
  query: z.object({ by: z.enum(["role", "partner", "court"]) })
});

export const notificationAudienceQuerySchema = z.object({
  query: z.object(campaignAudience).superRefine(requireAudienceTarget)
});

const campaignIdParams = z.object({ id: z.string().trim().min(1).max(40) });

export const notificationCampaignIdSchema = z.object({ params: campaignIdParams });

export const notificationCampaignRecipientsSchema = z.object({
  params: campaignIdParams,
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: optionalQuery(z.string().trim().max(160)),
    read: optionalQuery(z.enum(["true", "false"]))
  })
});

/** Recalling removes the notice from every inbox; the reason stays in the history and the audit log. */
export const notificationCampaignRecallSchema = z.object({
  params: campaignIdParams,
  body: z.object({ reason: z.string().trim().min(3, "Nhập lý do (ít nhất 3 ký tự)").max(1000) })
});
