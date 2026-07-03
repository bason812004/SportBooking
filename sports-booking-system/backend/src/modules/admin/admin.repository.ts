import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";

export const adminRepository = {
  dashboard() {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return prisma.$transaction([
      prisma.user.count(),
      prisma.partnerProfile.count(),
      prisma.court.count(),
      prisma.booking.count(),
      prisma.booking.aggregate({ where: { paymentStatus: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] } }, _sum: { totalPrice: true, refundAmount: true } }),
      prisma.commissionTransaction.aggregate({ where: { createdAt: { gte: monthStart } }, _sum: { commissionAmount: true, netAmount: true } }),
      prisma.court.count({ where: { approvalStatus: "PENDING" } }),
      prisma.partnerProfile.count({ where: { approvalStatus: "PENDING" } }),
      prisma.booking.groupBy({
        by: ["bookingDate"],
        where: { bookingDate: { gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29)) } },
        _count: true,
        _sum: { totalPrice: true },
        orderBy: { bookingDate: "asc" }
      }),
      prisma.court.findMany({
        where: { approvalStatus: "PENDING" },
        include: { category: true, partner: { select: { businessName: true } }, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
        orderBy: { createdAt: "desc" },
        take: 5
      })
    ]);
  },

  users(page: number, limit: number, filters: { search?: string; role?: any; status?: any }) {
    const where: Prisma.UserWhereInput = {
      role: filters.role,
      status: filters.status,
      OR: filters.search
        ? [
            { fullName: { contains: filters.search, mode: "insensitive" } },
            { email: { contains: filters.search, mode: "insensitive" } },
            { phone: { contains: filters.search, mode: "insensitive" } }
          ]
        : undefined
    };
    return prisma.$transaction([
      prisma.user.findMany({
        where,
        select: { id: true, fullName: true, email: true, phone: true, role: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.user.count({ where })
    ]);
  },

  setUserStatus(id: string, status: "ACTIVE" | "LOCKED") {
    return prisma.user.update({
      where: { id },
      data: { status },
      select: { id: true, fullName: true, email: true, role: true, status: true }
    });
  },

  userById(id: string) {
    return prisma.user.findUnique({ where: { id }, select: { id: true, role: true, status: true, fullName: true, email: true } });
  },

  activeAdminCount() {
    return prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
  },

  partners(page: number, limit: number, filters: { search?: string; status?: any }) {
    const where: Prisma.PartnerProfileWhereInput = {
      approvalStatus: filters.status,
      OR: filters.search
        ? [
            { businessName: { contains: filters.search, mode: "insensitive" } },
            { user: { fullName: { contains: filters.search, mode: "insensitive" } } },
            { user: { email: { contains: filters.search, mode: "insensitive" } } }
          ]
        : undefined
    };
    return prisma.$transaction([
      prisma.partnerProfile.findMany({
        where,
        include: { user: { select: { id: true, fullName: true, email: true, phone: true, status: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.partnerProfile.count({ where })
    ]);
  },

  partnerDetail(id: string) {
    return prisma.partnerProfile.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true, status: true, createdAt: true } },
        courts: { select: { id: true, name: true, approvalStatus: true, activeStatus: true } }
      }
    });
  },

  setPartnerApproval(id: string, approvalStatus: "APPROVED" | "REJECTED") {
    return prisma.partnerProfile.update({ where: { id }, data: { approvalStatus } });
  },

  pendingCourts() {
    return prisma.court.findMany({
      where: { approvalStatus: "PENDING" },
      include: { category: true, partner: { include: { user: { select: { fullName: true, email: true } } } }, images: true },
      orderBy: { createdAt: "desc" }
    });
  },

  setCourtApproval(id: string, approvalStatus: "APPROVED" | "REJECTED", rejectionReason?: string) {
    return prisma.court.update({ where: { id }, data: { approvalStatus, rejectionReason } });
  },

  categories() {
    return prisma.courtCategory.findMany({ orderBy: { createdAt: "desc" } });
  },
  createCategory(data: Prisma.CourtCategoryCreateInput) {
    return prisma.courtCategory.create({ data });
  },
  updateCategory(id: string, data: Prisma.CourtCategoryUpdateInput) {
    return prisma.courtCategory.update({ where: { id }, data });
  },
  deleteCategory(id: string) {
    return prisma.courtCategory.update({ where: { id }, data: { status: "INACTIVE" } });
  },

  reviews() {
    return prisma.review.findMany({
      include: { user: { select: { fullName: true, email: true } }, court: { select: { name: true } } },
      orderBy: { createdAt: "desc" }
    });
  },
  setReviewDisplay(id: string, displayStatus: "VISIBLE" | "HIDDEN") {
    return prisma.review.update({ where: { id }, data: { displayStatus } });
  },
  deleteReview(id: string) {
    return prisma.review.delete({ where: { id } });
  },

  reports() {
    return prisma.report.findMany({
      include: { user: { select: { fullName: true, email: true } }, court: { select: { name: true } } },
      orderBy: { createdAt: "desc" }
    });
  },
  setReportStatus(id: string, status: "RESOLVED" | "REJECTED") {
    return prisma.report.update({ where: { id }, data: { status, resolvedAt: new Date() } });
  },

  statistics() {
    return prisma.$transaction([
      prisma.booking.groupBy({ by: ["bookingStatus"], orderBy: { bookingStatus: "asc" }, _count: true, _sum: { totalPrice: true } }),
      prisma.court.groupBy({ by: ["city"], orderBy: { city: "asc" }, _count: true }),
      prisma.review.aggregate({ _avg: { rating: true }, _count: true })
    ]);
  },

  moderationHistory(entityType: string, entityId: string) {
    return prisma.moderationHistory.findMany({ where: { entityType, entityId }, orderBy: { createdAt: "desc" } });
  },

  addModerationHistory(data: { entityType: string; entityId: string; action: string; reason?: string; actorId: string }) {
    return prisma.moderationHistory.create({ data });
  },

  vouchers(page: number, limit: number, filters: { search?: string; status?: string }) {
    const search = filters.search ? `%${filters.search}%` : null;
    return prisma.$transaction([
      prisma.$queryRaw<any[]>`
        select v.id, v.code, v.title, v.discount_type::text as "discountType",
          v.discount_value::float as "discountValue", v.used_count as "usedCount",
          v.usage_limit as "usageLimit", v.start_date as "startDate", v.end_date as "endDate",
          v.status::text, p.business_name as "businessName", c.name as "courtName"
        from vouchers v join partner_profiles p on p.id = v.partner_id
        left join courts c on c.id = v.court_id
        where (${filters.status ?? null}::text is null or v.status::text = ${filters.status ?? null})
          and (${search}::text is null or v.code ilike ${search} or v.title ilike ${search} or p.business_name ilike ${search})
        order by v.created_at desc offset ${(page - 1) * limit} limit ${limit}
      `,
      prisma.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count from vouchers v join partner_profiles p on p.id = v.partner_id
        where (${filters.status ?? null}::text is null or v.status::text = ${filters.status ?? null})
          and (${search}::text is null or v.code ilike ${search} or v.title ilike ${search} or p.business_name ilike ${search})
      `
    ]);
  },

  setVoucherStatus(id: string, status: "ACTIVE" | "DISABLED") {
    return prisma.$executeRaw`update vouchers set status = ${status}::voucher_status, updated_at = now() where id = ${id}`;
  },

  pendingBlogs(page: number, limit: number, search?: string) {
    const pattern = search ? `%${search}%` : null;
    return prisma.$transaction([
      prisma.$queryRaw<any[]>`
        select b.id, b.title, b.excerpt, b.content, b.cover_image_url as "coverImageUrl",
          b.status::text, b.created_at as "createdAt", u.full_name as "authorName", u.email as "authorEmail"
        from blog_posts b join users u on u.id = b.author_id
        where b.status = 'PENDING'::blog_post_status
          and (${pattern}::text is null or b.title ilike ${pattern} or u.full_name ilike ${pattern})
        order by b.created_at desc offset ${(page - 1) * limit} limit ${limit}
      `,
      prisma.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count from blog_posts b join users u on u.id = b.author_id
        where b.status = 'PENDING'::blog_post_status
          and (${pattern}::text is null or b.title ilike ${pattern} or u.full_name ilike ${pattern})
      `
    ]);
  },

  moderateBlog(id: string, status: "PUBLISHED" | "REJECTED") {
    return prisma.$executeRaw`
      update blog_posts set status = ${status}::blog_post_status,
        published_at = case when ${status} = 'PUBLISHED' then now() else published_at end, updated_at = now()
      where id = ${id}::uuid and status = 'PENDING'::blog_post_status
    `;
  },

  pendingTournaments(page: number, limit: number, search?: string) {
    const pattern = search ? `%${search}%` : null;
    return prisma.$transaction([
      prisma.$queryRaw<any[]>`
        select t.id, t.title, t.description, t.sport_type as "sportType",
          t.start_date as "startDate", t.end_date as "endDate", t.status::text,
          p.business_name as "businessName", c.name as "courtName"
        from tournaments t join partner_profiles p on p.id = t.partner_id join courts c on c.id = t.court_id
        where t.status = 'PENDING'::tournament_status
          and (${pattern}::text is null or t.title ilike ${pattern} or p.business_name ilike ${pattern})
        order by t.created_at desc offset ${(page - 1) * limit} limit ${limit}
      `,
      prisma.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count from tournaments t join partner_profiles p on p.id = t.partner_id
        where t.status = 'PENDING'::tournament_status
          and (${pattern}::text is null or t.title ilike ${pattern} or p.business_name ilike ${pattern})
      `
    ]);
  },

  moderateTournament(id: string, status: "APPROVED" | "REJECTED") {
    return prisma.$executeRaw`
      update tournaments set status = ${status}::tournament_status, updated_at = now()
      where id = ${id}::uuid and status = 'PENDING'::tournament_status
    `;
  },

  auditLogs(page: number, limit: number, search?: string) {
    const where: Prisma.AuditLogWhereInput = search ? {
      OR: [
        { action: { contains: search, mode: "insensitive" } },
        { entityType: { contains: search, mode: "insensitive" } },
        { entityId: { contains: search, mode: "insensitive" } },
        { actor: { fullName: { contains: search, mode: "insensitive" } } }
      ]
    } : {};
    return prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        include: { actor: { select: { fullName: true, email: true, role: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.auditLog.count({ where })
    ]);
  },

  blockchainLogs(page: number, limit: number, filters: { search?: string; status?: string }) {
    const where: Prisma.BlockchainLogWhereInput = {
      status: filters.status,
      OR: filters.search ? [
        { entityType: { contains: filters.search, mode: "insensitive" } },
        { entityId: { contains: filters.search, mode: "insensitive" } },
        { txHash: { contains: filters.search, mode: "insensitive" } }
      ] : undefined
    };
    return prisma.$transaction([
      prisma.blockchainLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.blockchainLog.count({ where })
    ]);
  },

  retryBlockchainLog(id: string) {
    return prisma.blockchainLog.update({
      where: { id },
      data: { attempts: { increment: 1 }, status: "PENDING", error: "Blockchain provider is not configured" }
    });
  }
};
