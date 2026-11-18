import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { paginationMeta } from "../../shared/utils/response.js";
import { maskAccountNumber } from "../../shared/utils/bankAccount.js";
import { buildExcelReport, buildPdfReport, type ReportExportColumn } from "../../shared/utils/reportExport.js";
import { parseLimit, parsePage, vietnamDateTimeText, vietnamNow } from "../../shared/utils/time.js";
import { slugify } from "../../shared/utils/slug.js";
import { forgetAccountStatus } from "../auth/accountStatus.js";
import { checkoutBreakdown, withBookingBill } from "../checkout/checkout.calculations.js";
import { commissionService, monthRange } from "../commission/commission.service.js";
import { courtImageRepository } from "../court-images/courtImage.repository.js";
import { notifyCourtChange } from "../bookings/bookingNotices.js";
import { partnerRepository } from "../partner/partner.repository.js";
import { notificationService } from "../notifications/notification.service.js";
import { realtimeEvents } from "../realtime/realtime.events.js";
import { realtimeService } from "../realtime/realtime.service.js";
import { reportRepository } from "../business-report/report.repository.js";
import {
  REPORT_MEASURE_OPTIONS,
  REPORT_NOTICES,
  buildThread,
  decisionMeasures,
  decisionNoticeText,
  detectedMeasures,
  messageNoticeText,
  type ReportMeasure
} from "../reports/report.thread.js";
import { rankCourts, rankPartners, reviewTrend, summarizeRatings } from "../reviews/review.calculations.js";
import { reviewRepository } from "../reviews/review.repository.js";
import { bookingOverdueService } from "../booking-overdue/bookingOverdue.service.js";
import { voucherRepository } from "../vouchers/voucher.repository.js";
import { assertVoucherCodeFree, requireFullTerms, voucherService, withVoucherCodeGuard } from "../vouchers/voucher.service.js";
import { activationProblem, normalizeVoucherTerms, runningVoucherChanges, type VoucherTermsInput } from "../vouchers/voucher.terms.js";
import { recordAdminAction, verifyAuditChain } from "./admin.audit.js";
import { adminBookingChanges, type AdminBookingUpdate } from "./admin.bookingUpdate.js";
import { APPROVAL_REVOKE_HOURS, COURT_DECISION_ACTIONS, approvalRevocableUntil, courtReviewChecks, partnerProfileChecks } from "./admin.courtReview.js";
import { adminRepository, type AdminVoucherTerms, type CampaignAudience } from "./admin.repository.js";
import { recipientGroups, type RecipientGrouping } from "./admin.campaignRecipients.js";
import { commissionPdf, commissionSheets } from "./admin.commissionExport.js";
import { reviewStatsPdf, reviewStatsPeriodText, reviewStatsSheets } from "./admin.reviewStatsExport.js";

function billTotalsById(rows: Awaited<ReturnType<typeof adminRepository.bookingBillRows>>) {
  return new Map(rows.map((row) => [row.id, checkoutBreakdown(row, row.bookingServices).totalAmount]));
}

function categorySlug(name: string) {
  const slug = slugify(name);
  if (!slug) throw new ValidationError("Ten danh muc can co chu hoac so");
  return slug;
}

/** Names and slugs are unique: say so plainly instead of surfacing the database's unique-constraint error. */
async function assertCategoryAvailable(name: string, slug: string, excludeId?: string) {
  if (await adminRepository.categoryConflict(name, slug, excludeId)) {
    throw new ConflictError("Ten danh muc da ton tai");
  }
}

/** Why a court approval/rejection changed nothing: the court is gone, already decided, or its partner is not approved. */
async function courtDecisionError(id: string) {
  const court = await adminRepository.courtApprovalState(id);
  if (!court) return new NotFoundError("Khong tim thay san");
  if (court.approvalStatus !== "PENDING") return new ConflictError("Sân không còn ở trạng thái chờ duyệt, hãy tải lại trang");
  if (court.partner.approvalStatus !== "APPROVED") {
    return new ConflictError("Đối tác chưa được duyệt hồ sơ. Hãy duyệt đối tác trước khi duyệt sân.");
  }
  return new ConflictError("Không thể cập nhật trạng thái sân, hãy thử lại");
}

/** Why a partner approval/rejection changed nothing: the profile is gone or no longer pending. */
async function partnerDecisionError(id: string) {
  const partner = await adminRepository.partnerApprovalState(id);
  if (!partner) return new NotFoundError("Khong tim thay doi tac");
  return new ConflictError("Hồ sơ đối tác không còn ở trạng thái chờ duyệt, hãy tải lại trang");
}

const partnerDecisionNotices = {
  APPROVED: {
    title: "Hồ sơ đối tác đã được duyệt",
    type: "PARTNER_APPROVED",
    body: "Bạn có thể đăng ký sân để admin duyệt và bắt đầu nhận đặt sân.",
    reasonLabel: "Ghi chú"
  },
  REJECTED: {
    title: "Hồ sơ đối tác cần bổ sung",
    type: "PARTNER_REJECTED",
    body: "Hãy cập nhật thông tin trong trang Cài đặt rồi lưu để gửi duyệt lại.",
    reasonLabel: "Lý do"
  }
} as const;

/** Tells the partner what the review decided and why; the decision is already saved, so a failed notice only logs. */
async function notifyPartnerDecision(userId: string, partnerId: string, outcome: keyof typeof partnerDecisionNotices, reason?: string) {
  const notice = partnerDecisionNotices[outcome];
  const why = reason?.trim().replace(/[.\s]+$/, "");
  try {
    await notificationService.create({
      userId,
      title: notice.title,
      content: `${why ? `${notice.reasonLabel}: ${why}. ` : ""}${notice.body}`,
      type: notice.type,
      metadata: { partnerId }
    });
  } catch (error) {
    console.error("[PartnerModeration] Partner notification failed:", error);
  }
}

const paginatedRaw = (items: any[], countRows: Array<{ count: bigint }>, page: number, limit: number) => ({
  items,
  meta: paginationMeta(page, limit, Number(countRows[0]?.count ?? 0))
});

/** The month's ledger figures and the wallets as they stand, summed over the partners. */
const FINANCE_SUMMARY_FIELDS = [
  "grossAmount",
  "commissionAmount",
  "netAmount",
  "refundAmount",
  "platformRetainedAmount",
  "transactionCount",
  "refundCount",
  "paidOutAmount",
  "paidOutCount",
  "walletPending",
  "walletAvailable",
  "commissionDebt"
] as const;

const financeSummary = (items: any[]) =>
  Object.fromEntries(
    FINANCE_SUMMARY_FIELDS.map((field) => [field, items.reduce((sum, item) => sum + Number(item[field] ?? 0), 0)])
  ) as Record<(typeof FINANCE_SUMMARY_FIELDS)[number], number>;

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const blogAuthorNotices = {
  PUBLISHED: { title: "Bài viết đã được duyệt", type: "BLOG_PUBLISHED", body: (title: string) => `Bài "${title}" đã được xuất bản trên trang blog.` },
  RESTORED: { title: "Bài viết đã được hiển thị lại", type: "BLOG_PUBLISHED", body: (title: string) => `Bài "${title}" đã hiển thị lại trên trang blog.` },
  REJECTED: { title: "Bài viết bị từ chối", type: "BLOG_REJECTED", body: (title: string) => `Bài "${title}" chưa được duyệt.` },
  HIDDEN: { title: "Bài viết đã bị ẩn", type: "BLOG_HIDDEN", body: (title: string) => `Bài "${title}" đã bị ẩn khỏi trang blog.` }
} as const;

/** Tells the author what moderation decided; the decision is already saved, so a failed notice only logs. */
async function notifyBlogAuthor(
  blog: { id: string; authorId: string; title: string; slug: string },
  outcome: keyof typeof blogAuthorNotices,
  reason?: string
) {
  const notice = blogAuthorNotices[outcome];
  const followUp = outcome === "REJECTED" || outcome === "HIDDEN" ? " Bạn có thể sửa bài và gửi duyệt lại." : "";
  const why = reason?.trim().replace(/[.\s]+$/, "");
  try {
    await notificationService.create({
      userId: blog.authorId,
      title: notice.title,
      content: `${notice.body(blog.title)}${why ? ` Lý do: ${why}.` : ""}${followUp}`,
      type: notice.type,
      metadata: { blogId: blog.id, slug: blog.slug }
    });
  } catch (error) {
    console.error("[BlogModeration] Author notification failed:", error);
  }
}

/** A post an admin can moderate: it exists and is public (a private post is only its author's and skips review). */
async function moderatableBlog(id: string) {
  const blog = await adminRepository.blogForModeration(id);
  if (!blog) throw new NotFoundError("Không tìm thấy bài viết");
  if (blog.visibility === "PRIVATE") throw new ValidationError("Bài riêng tư chỉ tác giả xem nên không cần kiểm duyệt");
  return blog;
}

/** Keeps only the target fields the audience uses, so a campaign never records a stale user, partner or role. */
function campaignAudience(input: CampaignAudience): CampaignAudience {
  return {
    targetType: input.targetType,
    targetRole: input.targetType === "ROLE" ? input.targetRole : undefined,
    targetUserId: input.targetType === "USER" ? input.targetUserId : undefined,
    targetPartnerId: input.targetType === "PARTNER" ? input.targetPartnerId : undefined,
    // An account ticked in two groups of the picker is still one recipient.
    targetUserIds: input.targetType === "USERS" ? [...new Set(input.targetUserIds ?? [])] : undefined
  };
}

const reviewAuthorNotices = {
  HIDDEN: { title: "Đánh giá của bạn đã bị ẩn", type: "REVIEW_HIDDEN", body: (court: string) => `Đánh giá của bạn về sân ${court} đã bị ẩn khỏi trang sân.` },
  RESTORED: { title: "Đánh giá của bạn đã hiển thị lại", type: "REVIEW_RESTORED", body: (court: string) => `Đánh giá của bạn về sân ${court} đã hiển thị lại.` },
  DELETED: { title: "Đánh giá của bạn đã bị xóa", type: "REVIEW_DELETED", body: (court: string) => `Đánh giá của bạn về sân ${court} đã bị quản trị viên xóa.` }
} as const;

/** Tells the author what moderation decided about their review; the decision is saved, so a failed notice only logs. */
async function notifyReviewAuthor(
  review: { id: string; userId: string; courtId: string; court: { name: string } },
  outcome: keyof typeof reviewAuthorNotices,
  reason?: string
) {
  const notice = reviewAuthorNotices[outcome];
  const why = reason?.trim().replace(/[.\s]+$/, "");
  try {
    await notificationService.create({
      userId: review.userId,
      title: notice.title,
      content: `${notice.body(review.court.name)}${why ? ` Lý do: ${why}.` : ""}`,
      type: notice.type,
      metadata: { reviewId: review.id, courtId: review.courtId }
    });
  } catch (error) {
    console.error("[ReviewModeration] Author notification failed:", error);
  }
}

/**
 * Tells the customer about their report (an admin's message, or the decision with what was done); the change is
 * saved first, so a failed notice only logs. The notice opens the report's conversation.
 */
async function notifyReporter(
  report: { id: string; userId: string; courtId: string },
  notice: { title: string; type: string },
  content: string
) {
  try {
    await notificationService.create({
      userId: report.userId,
      title: notice.title,
      content,
      type: notice.type,
      metadata: { reportId: report.id, courtId: report.courtId }
    });
  } catch (error) {
    console.error("[Reports] Reporter notification failed:", error);
  }
}

export type ReportDecisionInput = { note?: string; measures?: string[]; auditIds?: string[]; applyToCourtPending?: boolean };

const REPORT_CLOSED = "Báo cáo đã đóng nên không gửi thêm tin nhắn được, hãy tải lại trang";

/** Days are Vietnam days: an entry at 01:00 on the 5th belongs to the 5th, not the 4th as in UTC. */
const vietnamDayStart = (day: string) => new Date(`${day}T00:00:00+07:00`);
const DAY_MS = 24 * 60 * 60 * 1000;

/** The review list's and statistics' shared scope; toDate counts its whole day. */
function reviewScope(query: { partnerId?: string; courtId?: string; fromDate?: string; toDate?: string }) {
  return {
    partnerId: query.partnerId || undefined,
    courtId: query.courtId || undefined,
    from: query.fromDate ? vietnamDayStart(query.fromDate) : undefined,
    to: query.toDate ? new Date(vietnamDayStart(query.toDate).getTime() + DAY_MS) : undefined
  };
}

/** Tells the court's partner that an admin locked (with the reason) or reopened it; the change is saved first. */
async function notifyCourtLock(partnerId: string, court: { id: string; name: string }, lockReason?: string) {
  try {
    const partner = await adminRepository.partnerApprovalState(partnerId);
    if (!partner) return;
    await notificationService.create({
      userId: partner.userId,
      title: lockReason ? "Sân bị quản trị viên khoá" : "Sân đã được mở lại",
      content: lockReason
        ? `Quản trị viên đã khoá sân ${court.name}: ${lockReason.replace(/[.\s]+$/, "")}. Sân không nhận đặt cho đến khi quản trị viên mở lại.`
        : `Quản trị viên đã mở lại sân ${court.name}.`,
      type: lockReason ? "COURT_LOCKED" : "COURT_UNLOCKED",
      metadata: { courtId: court.id }
    });
  } catch (error) {
    console.error("[CourtLock] Partner notification failed:", error);
  }
}

/** Tells the partner an admin took a court's approval back, and why; the court waits for review again. */
async function notifyApprovalRevoked(court: { id: string; name: string; partnerId: string }, reason: string) {
  try {
    const partner = await adminRepository.partnerApprovalState(court.partnerId);
    if (!partner) return;
    await notificationService.create({
      userId: partner.userId,
      title: "Sân bị thu hồi duyệt",
      content: `Quản trị viên đã thu hồi quyết định duyệt sân ${court.name}: ${reason.replace(/[.\s]+$/, "")}. Sân tạm ẩn, không nhận đặt mới và chờ duyệt lại; các đơn đã đặt vẫn giữ.`,
      type: "COURT_APPROVAL_REVOKED",
      metadata: { courtId: court.id }
    });
  } catch (error) {
    console.error("[CourtApprovalRevoked] Partner notification failed:", error);
  }
}

/** Longest list an admin can export at once: a PDF of more rows gets slow and nobody reads it. */
export const MAX_EXPORT_ROWS = 5000;

const accountStatusText: Record<string, string> = { ACTIVE: "Hoạt động", LOCKED: "Đã khóa", INACTIVE: "Ngừng hoạt động", BLOCKED: "Bị chặn" };
const approvalStatusText: Record<string, string> = { PENDING: "Chờ duyệt", APPROVED: "Đã duyệt", REJECTED: "Bị từ chối" };
const vndText = (value: number) => `${Math.round(value).toLocaleString("vi-VN")} đ`;
const dateTimeText = vietnamDateTimeText;
/** Every rate change ever made fits one export (they are rare); the page itself shows the latest 20. */
const COMMISSION_HISTORY_EXPORT_LIMIT = 1000;
// Booking dates are calendar days stored at UTC midnight.
const dayText = (value: Date | null) => (value ? value.toISOString().slice(0, 10).split("-").reverse().join("/") : "");

type ListExportQuery = { search?: string; status?: string; format: "excel" | "pdf" };

/** "tìm “abc” · Đã khóa", or "không lọc": what the export was narrowed to, for its title and the audit entry. */
function exportFilterText(query: ListExportQuery, statusText: Record<string, string>) {
  const parts = [query.search ? `tìm “${query.search}”` : null, query.status ? statusText[query.status] ?? query.status : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : "không lọc";
}

/**
 * One list as Excel (numbers stay numbers, so the sheet can sum them) or as a landscape PDF (money written out).
 * `pdfRows` overrides the rows shown in the PDF.
 */
function listFile(
  format: "excel" | "pdf",
  input: { title: string; subtitle: string; sheet: string; columns: ReportExportColumn[]; rows: Array<Record<string, unknown>>; pdfRows: Array<Record<string, unknown>> }
) {
  if (format === "excel") return buildExcelReport({ title: input.title, sheets: [{ name: input.sheet, columns: input.columns, rows: input.rows }] });
  return buildPdfReport({
    title: input.title,
    subtitle: input.subtitle,
    sections: [{ heading: input.sheet, table: { columns: input.columns, rows: input.pdfRows } }],
    orientation: "landscape",
    fontSize: 8
  });
}

type AdminVoucherInput = VoucherTermsInput & { courtId?: string | null };

/** A platform voucher's terms, normalized; when limited to one court, that court must exist. Codes are unique. */
async function platformVoucherTerms(input: AdminVoucherInput, excludeId?: string): Promise<AdminVoucherTerms> {
  const terms = normalizeVoucherTerms(input);
  if (input.courtId && !(await adminRepository.courtExists(input.courtId))) {
    throw new ValidationError("Sân áp dụng không tồn tại", { courtId: ["Sân áp dụng không tồn tại"] });
  }
  await assertVoucherCodeFree(terms.code, excludeId);
  return { ...terms, courtId: input.courtId || null };
}

const voucherPartnerNotices = {
  DISABLED: {
    title: "Voucher bị tạm ngưng",
    type: "VOUCHER_DISABLED",
    body: (code: string) => `Quản trị viên đã tạm ngưng voucher ${code}, khách hàng không dùng được mã này cho đến khi được kích hoạt lại.`
  },
  ACTIVE: {
    title: "Voucher đã được kích hoạt lại",
    type: "VOUCHER_ENABLED",
    body: (code: string) => `Quản trị viên đã kích hoạt lại voucher ${code}, khách hàng có thể dùng mã này tiếp.`
  }
} as const;

/** Tells the partner an admin stopped or restarted their voucher; the change is saved, so a failed notice only logs. */
async function notifyVoucherPartner(
  voucher: { id: string; code: string; partnerUserId: string | null },
  status: keyof typeof voucherPartnerNotices,
  reason?: string
) {
  if (!voucher.partnerUserId) return;
  const notice = voucherPartnerNotices[status];
  const why = reason?.trim().replace(/[.\s]+$/, "");
  try {
    await notificationService.create({
      userId: voucher.partnerUserId,
      title: notice.title,
      content: `${notice.body(voucher.code)}${why ? ` Lý do: ${why}.` : ""}`,
      type: notice.type,
      metadata: { voucherId: voucher.id, code: voucher.code }
    });
  } catch (error) {
    console.error("[VoucherModeration] Partner notification failed:", error);
  }
}

export const adminService = {
  async dashboard() {
    const [users, partners, courts, approvedCourts, bookings, money, commission, pendingCourts, pendingPartners, trend, pendingItems] =
      await adminRepository.dashboard();
    const gmv = Number(money._sum.totalPrice ?? 0);
    const refunds = Number(money._sum.refundAmount ?? 0);
    return {
      users,
      partners,
      courts,
      approvedCourts,
      bookings,
      pendingCourts,
      pendingPartners,
      financials: {
        gmv,
        refunds,
        platformCommission: Number(commission._sum.commissionAmount ?? 0),
        partnerPayout: Number(commission._sum.netAmount ?? 0)
      },
      trend: trend.map((item) => ({
        date: item.bookingDate.toISOString().slice(0, 10),
        bookings: item._count,
        gmv: Number(item._sum?.totalPrice ?? 0)
      })),
      pendingItems
    };
  },

  async users(query: any) {
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const [items, total] = await adminRepository.users(page, limit, {
      search: query.search || undefined,
      role: query.role || undefined,
      status: query.status || undefined,
      sortBy: query.sortBy || undefined,
      sortOrder: query.sortOrder || undefined
    });
    return { items, meta: paginationMeta(page, limit, total) };
  },

  /**
   * Customers (role USER only) matching the user list's search and status, every page of it, with their bookings and
   * spending. The file holds personal data: each export is written to the audit log.
   */
  async exportCustomers(actorId: string, query: ListExportQuery) {
    const filters = { search: query.search || undefined, status: query.status || undefined };
    const total = await adminRepository.countCustomersForExport(filters);
    if (total > MAX_EXPORT_ROWS) throw new ValidationError(`Danh sách có ${total} khách hàng, quá ${MAX_EXPORT_ROWS} dòng. Hãy lọc bớt rồi xuất lại.`);
    const customers = await adminRepository.customersForExport(filters, MAX_EXPORT_ROWS);
    const rows = customers.map((customer) => ({
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone ?? "",
      status: accountStatusText[customer.status] ?? customer.status,
      emailVerified: customer.emailVerified ? "Đã xác minh" : "Chưa",
      createdAt: dateTimeText(customer.createdAt),
      bookings: customer.bookings,
      totalSpent: customer.totalSpent,
      totalRefund: customer.totalRefund,
      lastBookingDate: dayText(customer.lastBookingDate)
    }));
    const filterText = exportFilterText(query, accountStatusText);
    const file = await listFile(query.format, {
      title: "Danh sách khách hàng",
      subtitle: `${rows.length} khách hàng · ${filterText} · xuất lúc ${dateTimeText(new Date())}`,
      sheet: "Khách hàng",
      columns: [
        { header: "Họ tên", key: "fullName", width: 26 },
        { header: "Email", key: "email", width: 30 },
        { header: "Số điện thoại", key: "phone", width: 15 },
        { header: "Trạng thái", key: "status", width: 14 },
        { header: "Xác minh email", key: "emailVerified", width: 15 },
        { header: "Ngày tạo", key: "createdAt", width: 18 },
        { header: "Số booking", key: "bookings", width: 11 },
        { header: "Tổng chi tiêu", key: "totalSpent", width: 16 },
        { header: "Đã hoàn", key: "totalRefund", width: 14 },
        { header: "Đặt gần nhất", key: "lastBookingDate", width: 14 }
      ],
      rows,
      pdfRows: rows.map((row) => ({ ...row, totalSpent: vndText(row.totalSpent), totalRefund: vndText(row.totalRefund) }))
    });
    await recordAdminAction(actorId, "CUSTOMERS_EXPORTED", "USER", "export", { filters: filterText, rows: rows.length, format: query.format });
    return file;
  },

  /** Partners matching the partner list's search and status, every page of it; account numbers keep their last 4 digits. */
  async exportPartners(actorId: string, query: ListExportQuery) {
    const filters = { search: query.search || undefined, status: query.status || undefined };
    const total = await adminRepository.countPartnersForExport(filters);
    if (total > MAX_EXPORT_ROWS) throw new ValidationError(`Danh sách có ${total} đối tác, quá ${MAX_EXPORT_ROWS} dòng. Hãy lọc bớt rồi xuất lại.`);
    const partners = await adminRepository.partnersForExport(filters, MAX_EXPORT_ROWS);
    const rows = partners.map((partner) => ({
      businessName: partner.businessName,
      ownerName: partner.user.fullName,
      email: partner.user.email,
      phone: partner.user.phone ?? "",
      address: partner.address,
      taxCode: partner.taxCode ?? "",
      approvalStatus: approvalStatusText[partner.approvalStatus] ?? partner.approvalStatus,
      accountStatus: accountStatusText[partner.user.status] ?? partner.user.status,
      courts: partner._count.courts,
      bankName: partner.bankName ?? "",
      bankAccountHolder: partner.bankAccountHolder ?? "",
      bankAccountNumber: maskAccountNumber(partner.bankAccountNumber) ?? "",
      createdAt: dateTimeText(partner.createdAt)
    }));
    const filterText = exportFilterText(query, approvalStatusText);
    const file = await listFile(query.format, {
      title: "Danh sách đối tác",
      subtitle: `${rows.length} đối tác · ${filterText} · xuất lúc ${dateTimeText(new Date())}`,
      sheet: "Đối tác",
      columns: [
        { header: "Doanh nghiệp", key: "businessName", width: 28 },
        { header: "Chủ tài khoản", key: "ownerName", width: 22 },
        { header: "Email", key: "email", width: 28 },
        { header: "Số điện thoại", key: "phone", width: 15 },
        { header: "Địa chỉ kinh doanh", key: "address", width: 34 },
        { header: "Mã số thuế", key: "taxCode", width: 15 },
        { header: "Hồ sơ", key: "approvalStatus", width: 12 },
        { header: "Tài khoản", key: "accountStatus", width: 12 },
        { header: "Số sân", key: "courts", width: 8 },
        { header: "Ngân hàng", key: "bankName", width: 16 },
        { header: "Chủ TK ngân hàng", key: "bankAccountHolder", width: 22 },
        { header: "Số TK", key: "bankAccountNumber", width: 16 },
        { header: "Ngày đăng ký", key: "createdAt", width: 18 }
      ],
      rows,
      pdfRows: rows
    });
    await recordAdminAction(actorId, "PARTNERS_EXPORTED", "PARTNER", "export", { filters: filterText, rows: rows.length, format: query.format });
    return file;
  },

  async bookings(query: any) {
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const filters = {
      search: query.search || undefined,
      fromDate: query.fromDate || undefined,
      toDate: query.toDate || undefined,
      courtId: query.courtId || undefined,
      partnerId: query.partnerId || undefined,
      userId: query.userId || undefined,
      bookingStatus: query.bookingStatus || undefined,
      paymentStatus: query.paymentStatus || undefined,
      sortBy: query.sortBy || undefined,
      sortOrder: query.sortOrder || undefined
    };

    let items: any[];
    let total: number;
    let billTotals: Map<string, number>;
    if (filters.sortBy === "totalPrice") {
      // The list shows each booking's bill total (court + services - voucher), computed like the bill itself,
      // so this sort can't be an SQL ORDER BY: sort every matching id here, then load just the page.
      const ids = await adminRepository.bookingIds(filters);
      billTotals = billTotalsById(await adminRepository.bookingBillRows(ids));
      const direction = filters.sortOrder === "asc" ? 1 : -1;
      // Stable sort: equal totals keep the SQL order (total_price, then newest first).
      const pageIds = [...ids]
        .sort((a, b) => direction * ((billTotals.get(a) ?? 0) - (billTotals.get(b) ?? 0)))
        .slice((page - 1) * limit, page * limit);
      const rowsById = new Map((await adminRepository.bookingsByIds(pageIds)).map((row) => [row.id, row]));
      items = pageIds.map((id) => rowsById.get(id)).filter(Boolean);
      total = ids.length;
    } else {
      [items, total] = await adminRepository.bookings(page, limit, filters);
      billTotals = billTotalsById(await adminRepository.bookingBillRows(items.map((item) => item.id)));
    }

    return {
      items: items.map((item) => ({ ...item, billTotal: billTotals.get(item.id) ?? 0 })),
      meta: paginationMeta(page, limit, total)
    };
  },

  /** Every court's bookings that are over but still open, with when the system finishes each. */
  overdueBookings() {
    return bookingOverdueService.openOverdue();
  },

  bookingFilterOptions() {
    return adminRepository.bookingFilterOptions();
  },

  async bookingDetail(id: string) {
    const [booking, billRow] = await Promise.all([adminRepository.bookingDetail(id), adminRepository.bookingBillRow(id)]);
    if (!booking || !billRow) throw new NotFoundError("Khong tim thay don dat san");
    return { ...booking, bill: withBookingBill(billRow).bill };
  },

  async updateBookingAdmin(actorId: string, id: string, rawInput: AdminBookingUpdate) {
    const current = await adminRepository.bookingDetail(id);
    if (!current) throw new NotFoundError("Khong tim thay don dat san");
    const input = adminBookingChanges(current, rawInput);
    if (input.bookingStatus === "CANCELLED" && !input.cancelReason && !current.cancelReason) {
      throw new ValidationError("Can nhap ly do khi huy don");
    }
    if (input.refundAmount !== undefined && input.refundAmount > Number(current.totalPrice)) {
      throw new ValidationError("So tien hoan khong duoc lon hon tong tien don");
    }
    if (input.platformRetainedAmount !== undefined && input.platformRetainedAmount > Number(current.totalPrice)) {
      throw new ValidationError("So tien giu lai khong duoc lon hon tong tien don");
    }

    const action =
      input.refundAmount !== undefined || input.paymentStatus ? "REFUND_OR_PAYMENT_UPDATED" :
      "BOOKING_ADMIN_UPDATED";

    const result = await adminRepository.transaction(async (tx) => {
      const updated = await adminRepository.updateBookingAdmin(actorId, id, input, action, tx);
      if (!updated) return null;
      await recordAdminAction(actorId, action, "BOOKING", id, {
        bookingStatus: input.bookingStatus,
        paymentStatus: input.paymentStatus,
        refundAmount: input.refundAmount,
        platformRetainedAmount: input.platformRetainedAmount
      }, tx);
      return updated;
    });
    if (!result) throw new NotFoundError("Khong tim thay don dat san");
    if (result.settlement) {
      const settlement = result.settlement;
      realtimeService.toPartner(settlement.partnerId, realtimeEvents.settlementUpdated, settlement);
      realtimeService.toAdmin(realtimeEvents.settlementUpdated, settlement);
      realtimeService.toPartner(settlement.partnerId, realtimeEvents.walletUpdated, { partnerId: settlement.partnerId });
      realtimeService.toAdmin(realtimeEvents.walletUpdated, { partnerId: settlement.partnerId });
    }
    return result;
  },

  /**
   * Locking takes effect at once: the auth middleware re-checks the status, live sockets are dropped, and a
   * locked partner's courts leave the public pages (see partnerAccountActive). Existing bookings stay as they are.
   */
  async lockUser(actorId: string, id: string, reason?: string) {
    if (actorId === id) throw new ValidationError("Admin khong the tu khoa tai khoan cua minh");
    const target = await adminRepository.userById(id);
    if (!target) throw new NotFoundError("Khong tim thay tai khoan");
    if (target.role === "ADMIN" && target.status === "ACTIVE" && await adminRepository.activeAdminCount() <= 1) {
      throw new ValidationError("Khong the khoa Admin hoat dong cuoi cung");
    }
    const result = await adminRepository.transaction(async (tx) => {
      const locked = await adminRepository.setUserStatus(id, "LOCKED", tx);
      await recordAdminAction(actorId, "USER_LOCKED", "USER", id, { email: target.email, reason: reason || undefined }, tx);
      return locked;
    });
    forgetAccountStatus(id);
    realtimeService.disconnectUser(id);
    return result;
  },

  async unlockUser(actorId: string, id: string) {
    if (!(await adminRepository.userById(id))) throw new NotFoundError("Khong tim thay tai khoan");
    const result = await adminRepository.transaction(async (tx) => {
      const unlocked = await adminRepository.setUserStatus(id, "ACTIVE", tx);
      await recordAdminAction(actorId, "USER_UNLOCKED", "USER", id, undefined, tx);
      return unlocked;
    });
    forgetAccountStatus(id);
    return result;
  },

  async partners(query: any) {
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const [rows, total] = await adminRepository.partners(page, limit, {
      search: query.search || undefined,
      status: query.status || undefined
    });
    // Tax code, bank holder and email verification only feed the gap count; the list does not show them.
    const items = rows.map(({ taxCode, bankAccountHolder, _count, user: { emailVerified, ...user }, ...partner }) => ({
      ...partner,
      user,
      courtCount: _count.courts,
      missingChecks: partnerProfileChecks({
        emailVerified,
        phone: user.phone,
        taxCode,
        verificationDocumentUrl: partner.verificationDocumentUrl,
        bankAccountHolder
      }).filter((check) => check.status !== "ok").length
    }));
    return { items, meta: paginationMeta(page, limit, total) };
  },

  async partnerDetail(id: string) {
    const partner = await adminRepository.partnerDetail(id);
    if (!partner) throw new NotFoundError("Khong tim thay doi tac");
    return {
      ...partner,
      commissionRate: partner.commissionRate == null ? null : Number(partner.commissionRate),
      history: await adminRepository.moderationHistory("PARTNER", id),
      checks: partnerProfileChecks({
        emailVerified: partner.user.emailVerified,
        phone: partner.user.phone,
        taxCode: partner.taxCode,
        verificationDocumentUrl: partner.verificationDocumentUrl,
        bankAccountHolder: partner.bankAccountHolder
      })
    };
  },

  async approvePartner(actorId: string, id: string, reason?: string) {
    const decided = await adminRepository.transaction(async (tx) => {
      if (!(await adminRepository.decidePendingPartner(id, "APPROVED", tx))) return false;
      await adminRepository.addModerationHistory({ entityType: "PARTNER", entityId: id, action: "APPROVED", reason, actorId }, tx);
      await recordAdminAction(actorId, "PARTNER_APPROVED", "PARTNER", id, { reason }, tx);
      return true;
    });
    if (!decided) throw await partnerDecisionError(id);
    const partner = await adminRepository.partnerApprovalState(id);
    if (partner) await notifyPartnerDecision(partner.userId, id, "APPROVED", reason);
    return { id, approvalStatus: "APPROVED" as const };
  },

  async rejectPartner(actorId: string, id: string, reason: string) {
    const decided = await adminRepository.transaction(async (tx) => {
      if (!(await adminRepository.decidePendingPartner(id, "REJECTED", tx))) return false;
      await adminRepository.addModerationHistory({ entityType: "PARTNER", entityId: id, action: "REJECTED", reason, actorId }, tx);
      await recordAdminAction(actorId, "PARTNER_REJECTED", "PARTNER", id, { reason }, tx);
      return true;
    });
    if (!decided) throw await partnerDecisionError(id);
    const partner = await adminRepository.partnerApprovalState(id);
    if (partner) await notifyPartnerDecision(partner.userId, id, "REJECTED", reason);
    return { id, approvalStatus: "REJECTED" as const };
  },

  commissionDefault() { return commissionService.defaultRate(); },
  /** The audit keeps the rate before and after, so the history shows what each change replaced. */
  async updateCommissionDefault(actorId: string, rate: number) {
    const previous = await commissionService.defaultRate();
    return adminRepository.transaction(async (tx) => {
      const result = await commissionService.updateDefaultRate(rate, tx);
      await recordAdminAction(actorId, "COMMISSION_DEFAULT_UPDATED", "SYSTEM_SETTING", "commission.default_rate", {
        previousRate: previous.rate,
        rate: result.rate,
        partnersUsingDefault: previous.partnersUsingDefault
      }, tx);
      return result;
    });
  },
  partnerCommission(id: string) { return commissionService.partnerRate(id); },
  async updatePartnerCommission(actorId: string, id: string, rate: number | null) {
    const previous = await commissionService.partnerRate(id);
    return adminRepository.transaction(async (tx) => {
      const result = await commissionService.updatePartnerRate(id, rate, tx);
      await recordAdminAction(actorId, "PARTNER_COMMISSION_UPDATED", "PARTNER", id, { previousRate: previous.overrideRate, rate }, tx);
      return result;
    });
  },
  commissionHistory() { return commissionService.rateHistory(); },
  /** Every partner's rate with the day it took effect, and the whole change history, as Excel or PDF. */
  async exportCommission(format: "excel" | "pdf") {
    const [overview, history] = await Promise.all([commissionService.defaultRate(), commissionService.rateHistory(COMMISSION_HISTORY_EXPORT_LIMIT)]);
    if (format === "excel") return buildExcelReport({ title: "Tỷ lệ hoa hồng", sheets: commissionSheets(overview, history) });
    return buildPdfReport(commissionPdf(overview, history, new Date()));
  },
  commissionReport(month?: string) { return commissionService.adminReport(month); },

  async financeTransactions(query: any) {
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const range = monthRange(query.month);
    const [items, total] = await adminRepository.financeTransactions(page, limit, {
      month: range.month,
      from: range.from,
      to: range.to,
      search: query.search || undefined,
      partnerId: query.partnerId || undefined,
      transactionType: query.transactionType || undefined,
      eventType: query.eventType || undefined,
      sortBy: query.sortBy || undefined,
      sortOrder: query.sortOrder || undefined
    });
    return { items, meta: paginationMeta(page, limit, total) };
  },

  async financeRefunds(query: any) {
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const range = monthRange(query.month);
    const [items, total] = await adminRepository.financeRefunds(page, limit, {
      from: range.from,
      to: range.to,
      search: query.search || undefined,
      partnerId: query.partnerId || undefined,
      paymentStatus: query.paymentStatus || undefined,
      sortBy: query.sortBy || undefined,
      sortOrder: query.sortOrder || undefined
    });
    return { items, meta: paginationMeta(page, limit, total) };
  },

  async financeReconciliation(month?: string) {
    const range = monthRange(month);
    const partners = await adminRepository.financeReconciliation(range.from, range.to);
    return {
      month: range.month,
      summary: financeSummary(partners),
      partners
    };
  },

  async financeExport(month?: string) {
    const report = await this.financeReconciliation(month);
    const range = monthRange(report.month);
    // The rates the month's earnings were booked at (from the ledger), and each partner's rate now with since when.
    const [monthRates, rates] = await Promise.all([adminRepository.monthCommissionRates(range.from, range.to), commissionService.defaultRate()]);
    const currentRates = new Map(rates.partners.map((partner) => [partner.partnerId, partner]));
    const instantText = (value: Date) => {
      const { date, time } = vietnamNow(value);
      return `${date} ${time}`;
    };
    const header = [
      "month",
      "partner_id",
      "business_name",
      "gross_amount",
      "commission_amount",
      "net_amount",
      "transaction_count",
      "refund_amount",
      "platform_retained_amount",
      "refund_count",
      "paid_out_amount",
      "paid_out_count",
      "wallet_pending",
      "wallet_available",
      "commission_debt",
      "commission_rates_in_month",
      "current_commission_rate",
      "current_rate_source",
      "current_rate_applied_from"
    ];
    const lines = [
      header.join(","),
      ...report.partners.map((item: any) => [
        report.month,
        item.partnerId,
        item.businessName,
        item.grossAmount,
        item.commissionAmount,
        item.netAmount,
        item.transactionCount,
        item.refundAmount,
        item.platformRetainedAmount,
        item.refundCount,
        item.paidOutAmount,
        item.paidOutCount,
        item.walletPending,
        item.walletAvailable,
        item.commissionDebt,
        monthRates.get(item.partnerId) ?? "",
        currentRates.get(item.partnerId)?.rate ?? "",
        currentRates.get(item.partnerId)?.source ?? "",
        currentRates.has(item.partnerId) ? instantText(currentRates.get(item.partnerId)!.since) : ""
      ].map(csvCell).join(","))
    ];
    return {
      filename: `finance-report-${report.month}.csv`,
      content: `\ufeff${lines.join("\n")}`
    };
  },

  async notificationCampaigns(query: any) {
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const [items, total] = await adminRepository.notificationCampaigns(page, limit, {
      search: query.search || undefined,
      type: query.type || undefined,
      targetType: query.targetType || undefined,
      targetRole: query.targetRole || undefined
    });
    return { items, meta: paginationMeta(page, limit, total) };
  },

  async notificationCampaignDetail(id: string) {
    const campaign = await adminRepository.notificationCampaignDetail(id);
    if (!campaign) throw new NotFoundError("Không tìm thấy thông báo đã gửi");
    return campaign;
  },

  async notificationCampaignRecipients(id: string, query: any) {
    await this.notificationCampaignDetail(id);
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const [items, total] = await adminRepository.notificationCampaignRecipients(id, page, limit, {
      search: query.search || undefined,
      read: query.read === undefined ? undefined : query.read === "true"
    });
    return { items, meta: paginationMeta(page, limit, total) };
  },

  /** How many accounts a campaign would reach, shown in the confirmation before it is sent. */
  async notificationAudience(actorId: string, query: CampaignAudience) {
    const recipients = await adminRepository.campaignRecipientIds(campaignAudience(query), actorId);
    return { count: recipients.length };
  },

  /** The recipient picker's tree for one grouping: groups with their active accounts, the sending admin left out. */
  async notificationRecipientGroups(actorId: string, by: RecipientGrouping) {
    return recipientGroups(await adminRepository.campaignRecipientRows(by, actorId), by);
  },

  async createNotificationCampaign(actorId: string, input: any) {
    Object.assign(input, campaignAudience(input));
    const result = await adminRepository.transaction(async (tx) => {
      const created = await adminRepository.createNotificationCampaign(actorId, input, tx);
      if (!created) return null;
      await recordAdminAction(actorId, "NOTIFICATION_CAMPAIGN_SENT", "NOTIFICATION_CAMPAIGN", created.campaign.id, {
        targetType: input.targetType,
        targetRole: input.targetRole,
        targetUserId: input.targetUserId,
        targetPartnerId: input.targetPartnerId,
        targetUserIds: input.targetUserIds,
        recipientCount: created.campaign.recipientCount
      }, tx);
      return created;
    });
    if (!result) {
      throw new ValidationError(
        input.targetType === "USER" || input.targetType === "PARTNER"
          ? "Không gửi được: tài khoản nhận không tồn tại hoặc đang bị khóa"
          : input.targetType === "USERS"
            ? "Không gửi được: các tài khoản đã chọn không còn tồn tại hoặc đang bị khóa"
            : "Không có tài khoản nào thuộc nhóm nhận đã chọn"
      );
    }
    const { campaign, recipientIds } = result;
    realtimeService.toUsers(recipientIds, realtimeEvents.notificationNew, {
      campaignId: campaign.id,
      title: campaign.title,
      content: campaign.content,
      type: campaign.type
    });
    return campaign;
  },

  /** Takes a campaign sent by mistake back out of every inbox; it stays in the history marked recalled, with why. */
  async recallNotificationCampaign(actorId: string, id: string, reason: string) {
    const campaign = await this.notificationCampaignDetail(id);
    if (campaign.recalledAt) throw new ValidationError("Thông báo này đã được thu hồi");
    const recipientIds = await adminRepository.transaction(async (tx) => {
      const removed = await adminRepository.recallNotificationCampaign(id, actorId, reason, tx);
      if (!removed) return null;
      await recordAdminAction(actorId, "NOTIFICATION_CAMPAIGN_RECALLED", "NOTIFICATION_CAMPAIGN", id, {
        reason,
        removed: removed.length,
        readBeforeRecall: campaign.readCount
      }, tx);
      return removed;
    });
    if (!recipientIds) throw new ConflictError("Thông báo vừa được thu hồi, hãy tải lại trang");
    // Their inboxes refetch on this event and the recalled notice disappears.
    realtimeService.toUsers(recipientIds, realtimeEvents.notificationNew, { campaignId: id, recalled: true });
    return { id, removed: recipientIds.length };
  },

  async courts(query: any) {
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const [items, total] = await adminRepository.adminCourts(page, limit, {
      search: query.search || undefined,
      partnerId: query.partnerId || undefined,
      city: query.city || undefined,
      district: query.district || undefined,
      approvalStatus: query.approvalStatus || undefined,
      activeStatus: query.activeStatus || undefined,
      verified: query.verified || undefined,
      featured: query.featured || undefined,
      sortBy: query.sortBy || undefined,
      sortOrder: query.sortOrder || undefined
    });
    return { items, meta: paginationMeta(page, limit, total) };
  },

  async courtDetail(id: string) {
    const court = await adminRepository.adminCourtDetail(id);
    if (!court) throw new NotFoundError("Khong tim thay san");
    return court;
  },

  async updateCourtAdmin(actorId: string, id: string, input: any) {
    const current = await adminRepository.adminCourtDetail(id);
    if (!current) throw new NotFoundError("Khong tim thay san");
    const result = await adminRepository.transaction(async (tx) => {
      const updated = await adminRepository.updateAdminCourt(id, input, tx);
      if (!updated) return null;
      await recordAdminAction(actorId, "COURT_ADMIN_UPDATED", "COURT", id, {
        activeStatus: input.activeStatus,
        lockReason: input.lockReason,
        verified: input.verified,
        featured: input.featured,
        adminNote: input.adminNote
      }, tx);
      return updated;
    });
    if (!result) throw new NotFoundError("Khong tim thay san");
    if (input.activeStatus && input.activeStatus !== current.activeStatus) {
      await notifyCourtLock(result.partnerId, result, input.activeStatus === "INACTIVE" ? input.lockReason : undefined);
    }
    return result;
  },

  async requestCourtUpdate(actorId: string, id: string, note: string) {
    const result = await adminRepository.transaction(async (tx) => {
      const requested = await adminRepository.requestCourtUpdate(id, actorId, note, tx);
      if (requested) await recordAdminAction(actorId, "COURT_UPDATE_REQUESTED", "COURT", id, { note }, tx);
      return requested;
    });
    if (!result) throw new NotFoundError("Khong tim thay san");
    return result;
  },

  async pendingCourts(query: any) {
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const [items, total] = await adminRepository.pendingCourts(page, limit);
    return { items, meta: paginationMeta(page, limit, total) };
  },
  async courtReview(id: string) {
    const found = await adminRepository.courtReview(id);
    if (!found) throw new NotFoundError("Khong tim thay san");
    const { court, courtStats, duplicateAddressCourts } = found;
    const history = await adminRepository.moderationHistory("COURT", id);
    const partnerCourts = { APPROVED: 0, PENDING: 0, REJECTED: 0 };
    for (const row of courtStats) partnerCourts[row.approvalStatus] = row._count._all;
    const pendingImages = court.imageRequests.filter((request) => request.status === "PENDING").length;
    const { deposit_percent, latitude, longitude, prices, ...rest } = court;
    return {
      ...rest,
      depositPercent: deposit_percent == null ? null : Number(deposit_percent),
      latitude: latitude == null ? null : Number(latitude),
      longitude: longitude == null ? null : Number(longitude),
      prices: prices.map((price) => ({ ...price, price: Number(price.price) })),
      partnerCourts,
      duplicateAddressCourts,
      history,
      // history is newest first: the first decision in it is the latest.
      revocableUntil: approvalRevocableUntil(court.approvalStatus, history.find((entry) => COURT_DECISION_ACTIONS.includes(entry.action))),
      review: courtReviewChecks({
        courtStatus: court.approvalStatus,
        partnerStatus: court.partner.approvalStatus,
        publishedImages: court.images.length,
        pendingImages,
        duplicateAddressCourts: duplicateAddressCourts.length,
        partnerRejectedCourts: partnerCourts.REJECTED,
        accountCreatedAt: court.partner.user.createdAt,
        emailVerified: court.partner.user.emailVerified,
        phone: court.partner.user.phone,
        taxCode: court.partner.taxCode,
        verificationDocumentUrl: court.partner.verificationDocumentUrl,
        bankAccountHolder: court.partner.bankAccountHolder
      })
    };
  },
  /** The photos still waiting are approved with the court: the admin judged them on the same page. */
  async approveCourt(actorId: string, id: string) {
    const approvedImages = await adminRepository.transaction(async (tx) => {
      if (!(await adminRepository.approvePendingCourt(id, tx))) return null;
      const images = await courtImageRepository.approvePendingForCourt(id, actorId, tx);
      await adminRepository.addModerationHistory({ entityType: "COURT", entityId: id, action: "APPROVED", actorId }, tx);
      await recordAdminAction(actorId, "COURT_APPROVED", "COURT", id, images ? { approvedImages: images } : undefined, tx);
      return images;
    });
    if (approvedImages === null) throw await courtDecisionError(id);
    return { id, approvalStatus: "APPROVED" as const, approvedImages };
  },
  /** For the confirmation dialog: until when the approval can be taken back, and the upcoming bookings it leaves standing. */
  async approvalRevocation(id: string) {
    const court = await adminRepository.courtApprovalState(id);
    if (!court) throw new NotFoundError("Khong tim thay san");
    const revocableUntil = approvalRevocableUntil(court.approvalStatus, await adminRepository.latestCourtDecision(id));
    return { revocableUntil, bookings: revocableUntil ? await partnerRepository.upcomingBookings(id) : [] };
  },

  /**
   * Takes an approval back within APPROVAL_REVOKE_HOURS of it: the court returns to PENDING (hidden, no new bookings),
   * its upcoming bookings stand and their customers are told, the partner gets the reason. Later, admins lock the court.
   */
  async revokeCourtApproval(actorId: string, id: string, reason: string) {
    const court = await adminRepository.transaction(async (tx) => {
      const current = await adminRepository.lockCourtForDecision(id, tx);
      if (!current) throw new NotFoundError("Khong tim thay san");
      if (current.approvalStatus !== "APPROVED") throw new ConflictError("Sân không còn ở trạng thái đã duyệt, hãy tải lại trang");
      if (!approvalRevocableUntil(current.approvalStatus, await adminRepository.latestCourtDecision(id, tx))) {
        throw new ConflictError(`Chỉ hủy duyệt được trong ${APPROVAL_REVOKE_HOURS} giờ sau khi duyệt. Hãy dùng Khoá sân để ngừng nhận đặt.`);
      }
      await adminRepository.revokeCourtApproval(id, reason, tx);
      await adminRepository.addModerationHistory({ entityType: "COURT", entityId: id, action: "APPROVAL_REVOKED", reason, actorId }, tx);
      await recordAdminAction(actorId, "COURT_APPROVAL_REVOKED", "COURT", id, { reason }, tx);
      return current;
    });
    const upcoming = await partnerRepository.upcomingBookings(id);
    await notifyCourtChange(upcoming, court, "đang được quản trị viên xem xét lại nên tạm ngừng nhận đặt mới");
    await notifyApprovalRevoked(court, reason);
    return { id, approvalStatus: "PENDING" as const, notifiedBookings: upcoming.length };
  },
  async rejectCourt(actorId: string, id: string, reason: string) {
    const decided = await adminRepository.transaction(async (tx) => {
      if (!(await adminRepository.rejectPendingCourt(id, reason, tx))) return false;
      await adminRepository.addModerationHistory({ entityType: "COURT", entityId: id, action: "REJECTED", reason, actorId }, tx);
      await recordAdminAction(actorId, "COURT_REJECTED", "COURT", id, { reason }, tx);
      return true;
    });
    if (!decided) throw await courtDecisionError(id);
    return { id, approvalStatus: "REJECTED" as const, rejectionReason: reason };
  },

  categories() { return adminRepository.categories(); },
  async createCategory(actorId: string, input: any) {
    const slug = input.slug ?? categorySlug(input.name);
    await assertCategoryAvailable(input.name, slug);
    return adminRepository.transaction(async (tx) => {
      const result = await adminRepository.createCategory({ ...input, slug }, tx);
      await recordAdminAction(actorId, "CATEGORY_CREATED", "CATEGORY", result.id, { name: result.name }, tx);
      return result;
    });
  },
  async updateCategory(actorId: string, id: string, input: any) {
    const current = await adminRepository.categoryById(id);
    if (!current) throw new NotFoundError("Khong tim thay danh muc");
    // The form always resends the name: the slug only follows a real rename, never a description edit.
    const renamed = input.name !== undefined && input.name !== current.name;
    const slug = input.slug ?? (renamed ? categorySlug(input.name) : undefined);
    if (renamed || slug) await assertCategoryAvailable(input.name ?? current.name, slug ?? current.slug, id);
    return adminRepository.transaction(async (tx) => {
      const result = await adminRepository.updateCategory(id, { ...input, slug }, tx);
      await recordAdminAction(actorId, "CATEGORY_UPDATED", "CATEGORY", id, input, tx);
      return result;
    });
  },
  async deleteCategory(actorId: string, id: string) {
    if (!(await adminRepository.categoryById(id))) throw new NotFoundError("Khong tim thay danh muc");
    return adminRepository.transaction(async (tx) => {
      const result = await adminRepository.deleteCategory(id, tx);
      await recordAdminAction(actorId, "CATEGORY_DISABLED", "CATEGORY", id, undefined, tx);
      return result;
    });
  },

  async reviews(query: any) {
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const { items, total } = await reviewRepository.list(
      {
        ...reviewScope(query),
        search: query.search || undefined,
        status: query.status || undefined,
        rating: query.rating ? Number(query.rating) : undefined
      },
      page,
      limit
    );
    return { items, meta: paginationMeta(page, limit, total) };
  },
  /**
   * Statistics shown above the review list, for one partner, court and period: the average and star spread customers
   * see (hidden reviews apart), the reply and 1–2 star counts, the trend, and courts and partners lowest rated first.
   */
  async reviewStats(query: { partnerId?: string; courtId?: string; fromDate?: string; toDate?: string }) {
    const scope = reviewScope(query);
    const [counts, courts, days] = await Promise.all([
      reviewRepository.ratingCounts(scope),
      reviewRepository.statsByCourt(scope),
      reviewRepository.statsByDay(scope)
    ]);
    return {
      summary: summarizeRatings(counts),
      repliedCount: courts.reduce((sum, court) => sum + court.repliedCount, 0),
      lowCount: courts.reduce((sum, court) => sum + court.lowCount, 0),
      trend: reviewTrend(days, query.fromDate, query.toDate ?? vietnamNow().date),
      courts: rankCourts(courts),
      partners: rankPartners(courts)
    };
  },
  /** The statistics above as an Excel workbook (one sheet per table) or a PDF; only figures, so no audit entry. */
  async exportReviewStats(query: { partnerId?: string; courtId?: string; fromDate?: string; toDate?: string; format: "excel" | "pdf" }) {
    const scope = reviewScope(query);
    const [stats, scopeName] = await Promise.all([
      this.reviewStats(query),
      reportRepository.scopeName({ partnerId: scope.partnerId, courtId: scope.courtId })
    ]);
    const meta = {
      scopeText: scope.courtId ? `Sân: ${scopeName ?? scope.courtId}` : scope.partnerId ? `Đối tác: ${scopeName ?? scope.partnerId}` : "Toàn hệ thống",
      periodText: reviewStatsPeriodText(query.fromDate, query.toDate, vietnamNow().date),
      exportedAt: dateTimeText(new Date()),
      scoped: Boolean(scope.partnerId || scope.courtId)
    };
    if (query.format === "excel") return buildExcelReport({ title: "Thống kê đánh giá", sheets: reviewStatsSheets(stats, meta) });
    return buildPdfReport(reviewStatsPdf(stats, meta));
  },
  /** Hides or shows a review again; the decision and its reason go to the moderation history and to the author. */
  async setReviewDisplay(actorId: string, id: string, status: "VISIBLE" | "HIDDEN", reason?: string) {
    const review = await adminRepository.reviewForModeration(id);
    if (!review) throw new NotFoundError("Không tìm thấy đánh giá");
    if (review.displayStatus === status) {
      throw new ValidationError(status === "HIDDEN" ? "Đánh giá đã bị ẩn" : "Đánh giá đang hiển thị");
    }
    const changed = await adminRepository.transaction(async (tx) => {
      if (!(await adminRepository.setReviewDisplay(id, status, review.displayStatus, tx))) return false;
      await adminRepository.addModerationHistory({ entityType: "REVIEW", entityId: id, action: status, reason, actorId }, tx);
      await recordAdminAction(actorId, status === "HIDDEN" ? "REVIEW_HIDDEN" : "REVIEW_SHOWN", "REVIEW", id, { reason }, tx);
      return true;
    });
    if (!changed) throw new ConflictError("Đánh giá vừa được thay đổi, hãy tải lại trang");
    await notifyReviewAuthor(review, status === "HIDDEN" ? "HIDDEN" : "RESTORED", reason);
    return { id, displayStatus: status };
  },
  /** Removes a review for good; its content stays in the audit log so the decision can still be checked later. */
  async deleteReview(actorId: string, id: string, reason: string) {
    const review = await adminRepository.reviewForModeration(id);
    if (!review) throw new NotFoundError("Không tìm thấy đánh giá");
    const deleted = await adminRepository.transaction(async (tx) => {
      if (!(await adminRepository.deleteReview(id, tx))) return false;
      await adminRepository.addModerationHistory({ entityType: "REVIEW", entityId: id, action: "DELETED", reason, actorId }, tx);
      await recordAdminAction(actorId, "REVIEW_DELETED", "REVIEW", id, {
        reason,
        userId: review.userId,
        courtId: review.courtId,
        rating: review.rating,
        comment: review.comment
      }, tx);
      return true;
    });
    if (!deleted) throw new NotFoundError("Không tìm thấy đánh giá");
    await notifyReviewAuthor(review, "DELETED", reason);
    return { id, deleted: true };
  },
  /** Takes down the court owner's reply (the review stays); the partner is told why, the reply kept in the audit log. */
  async removeReviewReply(actorId: string, id: string, reason: string) {
    const review = await adminRepository.reviewForModeration(id);
    if (!review) throw new NotFoundError("Không tìm thấy đánh giá");
    if (!review.reply) throw new ValidationError("Đánh giá này chưa có phản hồi của chủ sân");
    const reply = review.reply;
    await adminRepository.transaction(async (tx) => {
      await reviewRepository.deleteReply(id, tx);
      await adminRepository.addModerationHistory({ entityType: "REVIEW", entityId: id, action: "REPLY_REMOVED", reason, actorId }, tx);
      await recordAdminAction(actorId, "REVIEW_REPLY_REMOVED", "REVIEW", id, { reason, reply: reply.content, repliedBy: reply.authorId }, tx);
    });
    const partnerUserId = review.court.partner?.userId;
    if (partnerUserId) {
      const why = reason.trim().replace(/[.\s]+$/, "");
      try {
        await notificationService.create({
          userId: partnerUserId,
          title: "Phản hồi đánh giá đã bị gỡ",
          content: `Quản trị viên đã gỡ phản hồi của bạn cho một đánh giá về sân ${review.court.name}. Lý do: ${why}.`,
          type: "REVIEW_REPLY_REMOVED",
          metadata: { reviewId: id, courtId: review.courtId }
        });
      } catch (error) {
        console.error("[ReviewModeration] Partner notification failed:", error);
      }
    }
    return { id, reply: null };
  },

  async reports(query: any) {
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const { items, total, counts, pendingByCourt, messageStats } = await adminRepository.reports(page, limit, {
      status: query.status || undefined,
      search: query.search || undefined
    });
    return {
      items: items.map((item) => {
        const stats = messageStats.get(item.id);
        return {
          ...item,
          courtPendingCount: pendingByCourt.get(item.courtId) ?? 0,
          messageCount: stats?.messageCount ?? 0,
          lastMessage: stats ? { authorRole: stats.authorRole, createdAt: stats.createdAt } : null
        };
      }),
      meta: paginationMeta(page, limit, total),
      counts
    };
  },

  /**
   * A report with its conversation. While it waits, also what the audit log shows was done about the court since it
   * came in (offered as measures to confirm when closing) and the court's other waiting reports.
   */
  async reportThread(id: string) {
    const report = await adminRepository.reportThread(id);
    if (!report) throw new NotFoundError("Không tìm thấy báo cáo");
    const open = report.status === "PENDING";
    const [audit, otherPending] = await Promise.all([
      open ? adminRepository.courtMeasureAudit(report.courtId, report.court.partner?.userId ?? null, report.createdAt) : [],
      open ? adminRepository.otherPendingReports(report.courtId, report.id) : []
    ]);
    const { messages, ...rest } = report;
    return {
      report: rest,
      entries: buildThread(report, messages, "ADMIN"),
      detectedMeasures: detectedMeasures(audit),
      measureOptions: REPORT_MEASURE_OPTIONS,
      otherPending: otherPending.map((item) => ({ id: item.id, reason: item.reason, createdAt: item.createdAt, reporterName: item.user.fullName }))
    };
  },

  /** An admin writes to the reporter while the report waits (to ask for details, or say what is being done). */
  async sendReportMessage(actorId: string, id: string, content: string) {
    const report = await adminRepository.reportById(id);
    if (!report) throw new NotFoundError("Không tìm thấy báo cáo");
    if (report.status !== "PENDING") throw new ConflictError(REPORT_CLOSED, "REPORT_CLOSED");
    const message = await adminRepository.transaction(async (tx) => {
      if (!(await adminRepository.lockPendingReport(id, tx))) throw new ConflictError(REPORT_CLOSED, "REPORT_CLOSED");
      const created = await adminRepository.createReportMessage({ reportId: id, authorId: actorId, kind: "MESSAGE", content }, tx);
      await recordAdminAction(actorId, "REPORT_MESSAGE_SENT", "REPORT", id, { courtId: report.courtId, messageId: created.id }, tx);
      return created;
    });
    await notifyReporter(report, REPORT_NOTICES.MESSAGE, messageNoticeText(report.court.name, content));
    return {
      id: message.id,
      kind: "MESSAGE" as const,
      authorRole: "ADMIN" as const,
      authorName: message.author?.fullName ?? null,
      content: message.content,
      measures: [],
      createdAt: message.createdAt
    };
  },

  /**
   * Closes a waiting report with the admin's words to the reporter (required) and, to resolve it, what was done:
   * audit entries the system found on the court (checked again here) and measures taken outside the system. With
   * applyToCourtPending the court's other waiting reports close the same way; one closed meanwhile is left out.
   * Each reporter gets the decision in their conversation and a notice.
   */
  async decideReport(actorId: string, id: string, status: "RESOLVED" | "REJECTED", input: ReportDecisionInput = {}) {
    const report = await adminRepository.reportById(id);
    if (!report) throw new NotFoundError("Không tìm thấy báo cáo");
    if (report.status !== "PENDING") throw new ConflictError("Báo cáo này đã được xử lý");
    const adminNote = input.note?.trim() || null;
    if (!adminNote) throw new ValidationError(status === "REJECTED" ? "Nhập lý do bác bỏ báo cáo" : "Nhập phản hồi gửi người báo cáo");
    let measures: ReportMeasure[] = [];
    if (status === "RESOLVED") {
      const auditIds = input.auditIds ?? [];
      const detected = auditIds.length
        ? detectedMeasures(await adminRepository.courtMeasureAudit(report.courtId, report.court.partner?.userId ?? null, report.createdAt))
        : [];
      const chosen = decisionMeasures(detected, auditIds, input.measures ?? []);
      if (!chosen) throw new ValidationError("Thao tác đã chọn không còn khớp với nhật ký của sân, hãy tải lại");
      if (!chosen.length) throw new ValidationError("Chọn ít nhất một biện pháp đã áp dụng");
      measures = chosen;
    }
    const closed = await adminRepository.transaction(async (tx) => {
      const others = input.applyToCourtPending ? await adminRepository.otherPendingReports(report.courtId, id, tx) : [];
      const targets = [{ id, userId: report.userId, reason: report.reason }, ...others];
      const done: Array<{ id: string; userId: string }> = [];
      for (const target of targets) {
        if (!(await adminRepository.decideReport(target.id, { status, resolvedBy: actorId, adminNote }, tx))) {
          if (target.id === id) return null;
          continue;
        }
        await adminRepository.createReportMessage({ reportId: target.id, authorId: actorId, kind: status, content: adminNote, measures }, tx);
        await recordAdminAction(actorId, status === "RESOLVED" ? "REPORT_RESOLVED" : "REPORT_REJECTED", "REPORT", target.id, {
          courtId: report.courtId,
          reason: target.reason,
          note: adminNote,
          ...(measures.length
            ? { measures: measures.map((measure) => (measure.auditId ? { code: measure.code, auditId: measure.auditId } : { code: measure.code })) }
            : {}),
          ...(target.id === id ? {} : { appliedFrom: id })
        }, tx);
        done.push({ id: target.id, userId: target.userId });
      }
      return done;
    });
    if (!closed) throw new ConflictError("Báo cáo vừa được quản trị viên khác xử lý, hãy tải lại trang");
    const content = decisionNoticeText(report.court.name, status, measures, adminNote);
    for (const target of closed) {
      await notifyReporter({ id: target.id, userId: target.userId, courtId: report.courtId }, REPORT_NOTICES[status], content);
    }
    return { id, status, adminNote, measures, closed: closed.map((target) => target.id) };
  },

  async statistics() {
    const [bookings, courtsByCity, reviews] = await adminRepository.statistics();
    return { bookings: bookings.map(x => ({ ...x, _sum: { totalPrice: Number(x._sum?.totalPrice ?? 0) } })), courtsByCity, reviews };
  },

  async vouchers(query: any) {
    const page = parsePage(query.page), limit = parseLimit(query.limit);
    const [items, count] = await adminRepository.vouchers(page, limit, {
      search: query.search || undefined,
      status: query.status || undefined
    });
    return paginatedRaw(items, count, page, limit);
  },
  /**
   * Admins run platform vouchers fully. A partner's voucher stays the partner's to launch and fund: an admin can only
   * disable it while it runs and later turn back on what an admin disabled.
   */
  async setVoucherStatus(actorId: string, id: string, status: "ACTIVE" | "DISABLED", reason?: string) {
    const voucher = await this.voucherDetail(id);
    if (status === "ACTIVE") {
      if (voucher.partnerId && !voucher.lockedByAdmin) {
        throw new ForbiddenError("Chỉ kích hoạt lại được voucher do quản trị viên tạm ngưng; voucher này do đối tác tự quản lý");
      }
      const problem = activationProblem(voucher);
      if (problem) throw new ValidationError(problem);
    } else if (voucher.status !== "ACTIVE") {
      throw new ValidationError("Voucher không đang hoạt động");
    }
    const from = status === "DISABLED" ? ["ACTIVE"] : voucher.partnerId ? ["DISABLED"] : ["DRAFT", "DISABLED"];
    const changed = await adminRepository.transaction(async (tx) => {
      if (!(await adminRepository.setVoucherStatus(id, status, from, tx))) return false;
      await adminRepository.addModerationHistory({ entityType: "VOUCHER", entityId: id, action: status, reason, actorId }, tx);
      await recordAdminAction(actorId, `VOUCHER_${status}`, "VOUCHER", id, { reason }, tx);
      return true;
    });
    if (!changed) throw new ConflictError("Trạng thái voucher vừa thay đổi, hãy tải lại trang");
    voucherService.invalidateListCache();
    if (status === "ACTIVE") {
      const [publicVoucher] = await voucherRepository.findActiveById(id);
      if (publicVoucher) realtimeService.toPublic(realtimeEvents.voucherNew, publicVoucher);
    } else {
      realtimeService.toPublic(realtimeEvents.voucherNew, { id, status: "DISABLED" });
    }
    await notifyVoucherPartner(voucher, status, reason);
    return { id, status };
  },

  async voucherDetail(id: string) {
    const voucher = await adminRepository.voucherDetail(id);
    if (!voucher) throw new NotFoundError("Không tìm thấy voucher");
    return voucher;
  },
  async createVoucher(actorId: string, input: AdminVoucherInput) {
    const terms = await platformVoucherTerms(input);
    const created = await withVoucherCodeGuard(() =>
      adminRepository.transaction(async (tx) => {
        const row = await adminRepository.createVoucher(terms, tx);
        await recordAdminAction(actorId, "VOUCHER_CREATED", "VOUCHER", row.id, { code: terms.code }, tx);
        return row;
      })
    );
    return this.voucherDetail(created.id);
  },
  /** A platform draft can change entirely; once launched only its wording, end date and usage limit (see voucher.terms). */
  async updateVoucher(actorId: string, id: string, input: Partial<AdminVoucherInput>) {
    const current = await this.voucherDetail(id);
    if (current.partnerId) throw new ForbiddenError("Voucher của đối tác do đối tác tự chỉnh sửa");
    const draftTerms = current.status === "DRAFT" ? await platformVoucherTerms(requireFullTerms(input), id) : null;
    const runningChanges = draftTerms ? null : runningVoucherChanges(current, input);
    await withVoucherCodeGuard(() =>
      adminRepository.transaction(async (tx) => {
        if (draftTerms) {
          if (!(await adminRepository.updateVoucherDraft(id, draftTerms, tx))) {
            throw new ConflictError("Voucher vừa được kích hoạt, hãy tải lại trang");
          }
        } else if (runningChanges && Object.keys(runningChanges).length && !(await voucherRepository.updateRunning(id, runningChanges, null, tx))) {
          throw new ConflictError("Voucher không còn sửa được, hãy tải lại trang");
        }
        await recordAdminAction(actorId, "VOUCHER_UPDATED", "VOUCHER", id, { code: current.code }, tx);
      })
    );
    if (!draftTerms) voucherService.invalidateListCache();
    return this.voucherDetail(id);
  },

  async pendingBlogs(query: any) {
    const page = parsePage(query.page), limit = parseLimit(query.limit);
    const [items, count, statusRows] = await adminRepository.pendingBlogs(page, limit, {
      search: query.search || undefined,
      status: query.status || "PENDING",
      authorRole: query.authorRole || undefined
    });
    const counts = Object.fromEntries(statusRows.map((row) => [row.status, row.count]));
    return { ...paginatedRaw(items, count, page, limit), counts };
  },
  async moderateBlog(actorId: string, id: string, status: "PUBLISHED" | "REJECTED", reason?: string) {
    const blog = await moderatableBlog(id);
    const from = status === "PUBLISHED" ? ["PENDING", "REJECTED", "HIDDEN"] : ["PENDING"];
    if (!from.includes(blog.status)) {
      throw new ValidationError(status === "PUBLISHED" ? "Bài viết đã được xuất bản" : "Chỉ từ chối được bài đang chờ duyệt");
    }
    const moderated = await adminRepository.transaction(async (tx) => {
      if (!(await adminRepository.moderateBlog(id, status, tx))) return false;
      await adminRepository.addModerationHistory({ entityType: "BLOG", entityId: id, action: status, reason, actorId }, tx);
      await recordAdminAction(actorId, `BLOG_${status}`, "BLOG", id, { reason, from: blog.status }, tx);
      return true;
    });
    if (!moderated) throw new ConflictError("Bài viết vừa được xử lý ở nơi khác, hãy tải lại trang");
    realtimeService.toPublic(realtimeEvents.blogUpdated, {});
    await notifyBlogAuthor(blog, status === "REJECTED" ? "REJECTED" : blog.status === "HIDDEN" ? "RESTORED" : "PUBLISHED", reason);
    return { id, status };
  },
  async hideBlog(actorId: string, id: string, reason: string) {
    const blog = await moderatableBlog(id);
    if (blog.status !== "PUBLISHED") throw new ValidationError("Chỉ ẩn được bài đang xuất bản");
    const hidden = await adminRepository.transaction(async (tx) => {
      if (!(await adminRepository.hideBlog(id, tx))) return false;
      await adminRepository.addModerationHistory({ entityType: "BLOG", entityId: id, action: "HIDDEN", reason, actorId }, tx);
      await recordAdminAction(actorId, "BLOG_HIDDEN", "BLOG", id, { reason }, tx);
      return true;
    });
    if (!hidden) throw new ConflictError("Bài viết vừa được xử lý ở nơi khác, hãy tải lại trang");
    realtimeService.toPublic(realtimeEvents.blogUpdated, {});
    await notifyBlogAuthor(blog, "HIDDEN", reason);
    return { id, status: "HIDDEN" };
  },
  /** Every moderation decision on the post, newest first, so a resubmitted post shows what was said before. */
  async blogHistory(id: string) {
    await moderatableBlog(id);
    return adminRepository.moderationHistory("BLOG", id);
  },
  async blogComments(id: string) {
    await moderatableBlog(id);
    return adminRepository.blogComments(id);
  },
  /** Removes a comment for good; the commenter is told why and what it said stays in the audit log. */
  async removeBlogComment(actorId: string, postId: string, commentId: string, reason: string) {
    const blog = await moderatableBlog(postId);
    const removed = await adminRepository.transaction(async (tx) => {
      const comment = await adminRepository.deleteBlogComment(postId, commentId, tx);
      if (!comment) return null;
      await adminRepository.addModerationHistory({ entityType: "BLOG_COMMENT", entityId: commentId, action: "DELETED", reason, actorId }, tx);
      await recordAdminAction(actorId, "BLOG_COMMENT_DELETED", "BLOG_COMMENT", commentId, {
        reason,
        postId,
        userId: comment.userId,
        content: comment.content
      }, tx);
      return comment;
    });
    if (!removed) throw new NotFoundError("Không tìm thấy bình luận");
    const why = reason.trim().replace(/[.\s]+$/, "");
    try {
      await notificationService.create({
        userId: removed.userId,
        title: "Bình luận của bạn đã bị xóa",
        content: `Quản trị viên đã xóa bình luận của bạn trong bài "${blog.title}". Lý do: ${why}.`,
        type: "BLOG_COMMENT_REMOVED",
        metadata: { blogId: postId, slug: blog.slug }
      });
    } catch (error) {
      console.error("[BlogModeration] Commenter notification failed:", error);
    }
    return { id: commentId, deleted: true };
  },

  async pendingTournaments(query: any) {
    const page = parsePage(query.page), limit = parseLimit(query.limit);
    const [items, count] = await adminRepository.pendingTournaments(page, limit, query.search || undefined);
    return paginatedRaw(items, count, page, limit);
  },
  async moderateTournament(actorId: string, id: string, status: "APPROVED" | "REJECTED", reason?: string) {
    const decided = await adminRepository.transaction(async (tx) => {
      if (!(await adminRepository.moderateTournament(id, status, tx))) return false;
      await adminRepository.addModerationHistory({ entityType: "TOURNAMENT", entityId: id, action: status, reason, actorId }, tx);
      await recordAdminAction(actorId, `TOURNAMENT_${status}`, "TOURNAMENT", id, { reason }, tx);
      return true;
    });
    if (!decided) throw new ValidationError("Giai dau khong con cho duyet");
    const [target] = await adminRepository.tournamentPartnerUser(id);
    if (target) {
      await notificationService.create({
        userId: target.userId,
        title: status === "APPROVED" ? "Giải đấu đã được duyệt" : "Giải đấu bị từ chối",
        content: status === "APPROVED"
          ? `Giải đấu "${target.title}" đã được duyệt và hiển thị công khai.`
          : `Giải đấu "${target.title}" đã bị từ chối.${reason ? ` Lý do: ${reason}` : ""}`,
        type: status === "APPROVED" ? "TOURNAMENT_APPROVED" : "TOURNAMENT_REJECTED",
        metadata: { tournamentId: id }
      });
    }
    return { id, status };
  },

  async auditLogs(query: any) {
    const page = parsePage(query.page), limit = parseLimit(query.limit);
    const [items, total] = await adminRepository.auditLogs(page, limit, {
      search: query.search || undefined,
      action: query.action || undefined,
      entityType: query.entityType || undefined,
      actorRole: query.actorRole || undefined,
      from: query.fromDate ? vietnamDayStart(query.fromDate) : undefined,
      to: query.toDate ? new Date(vietnamDayStart(query.toDate).getTime() + DAY_MS) : undefined,
      sortBy: query.sortBy || undefined,
      sortOrder: query.sortOrder || undefined
    });
    return { items, meta: paginationMeta(page, limit, total) };
  },
  async auditLogFilterOptions() {
    const [actions, entityTypes] = await adminRepository.auditLogFilterOptions();
    return { actions: actions.map((row) => row.action), entityTypes: entityTypes.map((row) => row.entityType) };
  },
  verifyAuditLogs() { return verifyAuditChain(); },
  async blockchainLogs(query: any) {
    const page = parsePage(query.page), limit = parseLimit(query.limit);
    const [items, total] = await adminRepository.blockchainLogs(page, limit, {
      search: query.search || undefined,
      status: query.status || undefined,
      sortBy: query.sortBy || undefined,
      sortOrder: query.sortOrder || undefined
    });
    return { items: items.map(({ audit_logs, ...item }) => ({ ...item, audit: audit_logs })), meta: paginationMeta(page, limit, total) };
  }
};
