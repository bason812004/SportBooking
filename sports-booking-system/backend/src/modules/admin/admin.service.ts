import { NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { paginationMeta } from "../../shared/utils/response.js";
import { parseLimit, parsePage } from "../../shared/utils/time.js";
import { slugify } from "../../shared/utils/slug.js";
import { commissionService } from "../commission/commission.service.js";
import { recordAdminAction, verifyAuditChain } from "./admin.audit.js";
import { adminRepository } from "./admin.repository.js";

const paginatedRaw = (items: any[], countRows: Array<{ count: bigint }>, page: number, limit: number) => ({
  items,
  meta: paginationMeta(page, limit, Number(countRows[0]?.count ?? 0))
});

export const adminService = {
  async dashboard() {
    const [users, partners, courts, bookings, money, commission, pendingCourts, pendingPartners, trend, pendingItems] =
      await adminRepository.dashboard();
    const gmv = Number(money._sum.totalPrice ?? 0);
    const refunds = Number(money._sum.refundAmount ?? 0);
    return {
      users,
      partners,
      courts,
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
      status: query.status || undefined
    });
    return { items, meta: paginationMeta(page, limit, total) };
  },

  async lockUser(actorId: string, id: string) {
    if (actorId === id) throw new ValidationError("Admin khong the tu khoa tai khoan cua minh");
    const target = await adminRepository.userById(id);
    if (!target) throw new NotFoundError("Khong tim thay tai khoan");
    if (target.role === "ADMIN" && target.status === "ACTIVE" && await adminRepository.activeAdminCount() <= 1) {
      throw new ValidationError("Khong the khoa Admin hoat dong cuoi cung");
    }
    const result = await adminRepository.setUserStatus(id, "LOCKED");
    await recordAdminAction(actorId, "USER_LOCKED", "USER", id, { email: target.email });
    return result;
  },

  async unlockUser(actorId: string, id: string) {
    const result = await adminRepository.setUserStatus(id, "ACTIVE");
    await recordAdminAction(actorId, "USER_UNLOCKED", "USER", id);
    return result;
  },

  async partners(query: any) {
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const [items, total] = await adminRepository.partners(page, limit, {
      search: query.search || undefined,
      status: query.status || undefined
    });
    return { items, meta: paginationMeta(page, limit, total) };
  },

  async partnerDetail(id: string) {
    const partner = await adminRepository.partnerDetail(id);
    if (!partner) throw new NotFoundError("Khong tim thay doi tac");
    return { ...partner, history: await adminRepository.moderationHistory("PARTNER", id) };
  },

  async approvePartner(actorId: string, id: string, reason?: string) {
    const result = await adminRepository.setPartnerApproval(id, "APPROVED");
    await adminRepository.addModerationHistory({ entityType: "PARTNER", entityId: id, action: "APPROVED", reason, actorId });
    await recordAdminAction(actorId, "PARTNER_APPROVED", "PARTNER", id, { reason });
    return result;
  },

  async rejectPartner(actorId: string, id: string, reason: string) {
    const result = await adminRepository.setPartnerApproval(id, "REJECTED");
    await adminRepository.addModerationHistory({ entityType: "PARTNER", entityId: id, action: "REJECTED", reason, actorId });
    await recordAdminAction(actorId, "PARTNER_REJECTED", "PARTNER", id, { reason });
    return result;
  },

  commissionDefault() { return commissionService.defaultRate(); },
  async updateCommissionDefault(actorId: string, rate: number) {
    const result = await commissionService.updateDefaultRate(rate);
    await recordAdminAction(actorId, "COMMISSION_DEFAULT_UPDATED", "SYSTEM_SETTING", "commission.default_rate", { rate });
    return result;
  },
  partnerCommission(id: string) { return commissionService.partnerRate(id); },
  async updatePartnerCommission(actorId: string, id: string, rate: number | null) {
    const result = await commissionService.updatePartnerRate(id, rate);
    await recordAdminAction(actorId, "PARTNER_COMMISSION_UPDATED", "PARTNER", id, { rate });
    return result;
  },
  commissionReport(month?: string) { return commissionService.adminReport(month); },

  pendingCourts() { return adminRepository.pendingCourts(); },
  async approveCourt(actorId: string, id: string) {
    const result = await adminRepository.setCourtApproval(id, "APPROVED", undefined);
    await adminRepository.addModerationHistory({ entityType: "COURT", entityId: id, action: "APPROVED", actorId });
    await recordAdminAction(actorId, "COURT_APPROVED", "COURT", id);
    return result;
  },
  async rejectCourt(actorId: string, id: string, reason: string) {
    const result = await adminRepository.setCourtApproval(id, "REJECTED", reason);
    await adminRepository.addModerationHistory({ entityType: "COURT", entityId: id, action: "REJECTED", reason, actorId });
    await recordAdminAction(actorId, "COURT_REJECTED", "COURT", id, { reason });
    return result;
  },

  categories() { return adminRepository.categories(); },
  async createCategory(actorId: string, input: any) {
    const result = await adminRepository.createCategory({ ...input, slug: input.slug ?? slugify(input.name) });
    await recordAdminAction(actorId, "CATEGORY_CREATED", "CATEGORY", result.id, { name: result.name });
    return result;
  },
  async updateCategory(actorId: string, id: string, input: any) {
    const result = await adminRepository.updateCategory(id, { ...input, slug: input.slug ?? (input.name ? slugify(input.name) : undefined) });
    await recordAdminAction(actorId, "CATEGORY_UPDATED", "CATEGORY", id, input);
    return result;
  },
  async deleteCategory(actorId: string, id: string) {
    const result = await adminRepository.deleteCategory(id);
    await recordAdminAction(actorId, "CATEGORY_DISABLED", "CATEGORY", id);
    return result;
  },

  reviews() { return adminRepository.reviews(); },
  async hideReview(actorId: string, id: string) { const result = await adminRepository.setReviewDisplay(id, "HIDDEN"); await recordAdminAction(actorId, "REVIEW_HIDDEN", "REVIEW", id); return result; },
  async showReview(actorId: string, id: string) { const result = await adminRepository.setReviewDisplay(id, "VISIBLE"); await recordAdminAction(actorId, "REVIEW_SHOWN", "REVIEW", id); return result; },
  async deleteReview(actorId: string, id: string) { const result = await adminRepository.deleteReview(id); await recordAdminAction(actorId, "REVIEW_DELETED", "REVIEW", id); return result; },

  reports() { return adminRepository.reports(); },
  async resolveReport(actorId: string, id: string) { const result = await adminRepository.setReportStatus(id, "RESOLVED"); await recordAdminAction(actorId, "REPORT_RESOLVED", "REPORT", id); return result; },
  async rejectReport(actorId: string, id: string) { const result = await adminRepository.setReportStatus(id, "REJECTED"); await recordAdminAction(actorId, "REPORT_REJECTED", "REPORT", id); return result; },

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
  async setVoucherStatus(actorId: string, id: string, status: "ACTIVE" | "DISABLED", reason?: string) {
    if (!(await adminRepository.setVoucherStatus(id, status))) throw new NotFoundError("Khong tim thay voucher");
    await adminRepository.addModerationHistory({ entityType: "VOUCHER", entityId: id, action: status, reason, actorId });
    await recordAdminAction(actorId, `VOUCHER_${status}`, "VOUCHER", id, { reason });
    return { id, status };
  },

  async pendingBlogs(query: any) {
    const page = parsePage(query.page), limit = parseLimit(query.limit);
    const [items, count] = await adminRepository.pendingBlogs(page, limit, query.search || undefined);
    return paginatedRaw(items, count, page, limit);
  },
  async moderateBlog(actorId: string, id: string, status: "PUBLISHED" | "REJECTED", reason?: string) {
    if (!(await adminRepository.moderateBlog(id, status))) throw new ValidationError("Bai viet khong con cho duyet");
    await adminRepository.addModerationHistory({ entityType: "BLOG", entityId: id, action: status, reason, actorId });
    await recordAdminAction(actorId, `BLOG_${status}`, "BLOG", id, { reason });
    return { id, status };
  },

  async pendingTournaments(query: any) {
    const page = parsePage(query.page), limit = parseLimit(query.limit);
    const [items, count] = await adminRepository.pendingTournaments(page, limit, query.search || undefined);
    return paginatedRaw(items, count, page, limit);
  },
  async moderateTournament(actorId: string, id: string, status: "APPROVED" | "REJECTED", reason?: string) {
    if (!(await adminRepository.moderateTournament(id, status))) throw new ValidationError("Giai dau khong con cho duyet");
    await adminRepository.addModerationHistory({ entityType: "TOURNAMENT", entityId: id, action: status, reason, actorId });
    await recordAdminAction(actorId, `TOURNAMENT_${status}`, "TOURNAMENT", id, { reason });
    return { id, status };
  },

  async auditLogs(query: any) {
    const page = parsePage(query.page), limit = parseLimit(query.limit);
    const [items, total] = await adminRepository.auditLogs(page, limit, query.search);
    return { items, meta: paginationMeta(page, limit, total) };
  },
  verifyAuditLogs() { return verifyAuditChain(); },
  async blockchainLogs(query: any) {
    const page = parsePage(query.page), limit = parseLimit(query.limit);
    const [items, total] = await adminRepository.blockchainLogs(page, limit, {
      search: query.search || undefined,
      status: query.status || undefined
    });
    return { items, meta: paginationMeta(page, limit, total) };
  },
  async retryBlockchainLog(actorId: string, id: string) {
    const result = await adminRepository.retryBlockchainLog(id);
    await recordAdminAction(actorId, "BLOCKCHAIN_LOG_RETRIED", "BLOCKCHAIN_LOG", id);
    return result;
  }
};
