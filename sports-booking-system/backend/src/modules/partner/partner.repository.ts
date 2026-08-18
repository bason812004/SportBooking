import { Prisma, type ApprovalStatus, type BookingStatus } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { normalizeBookingServices } from "../../shared/utils/bookingServices.js";

const columnExistsCache = new Map<string, boolean>([
  ["blog_posts.allow_comments", true],
  ["courts.deposit_percent", true]
]);

async function columnExists(tableName: string, columnName: string) {
  const cacheKey = `${tableName}.${columnName}`;
  const cached = columnExistsCache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const [row] = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      select exists(
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = ${tableName}
          and column_name = ${columnName}
      ) as "exists"
    `;
    const exists = Boolean(row?.exists);
    columnExistsCache.set(cacheKey, exists);
    return exists;
  } catch (err) {
    columnExistsCache.set(cacheKey, true);
    return true;
  }
}

function bookingOrderBy(sortBy?: string, sortOrder?: string): Prisma.BookingOrderByWithRelationInput[] {
  const order: "asc" | "desc" = sortOrder === "asc" ? "asc" : "desc";
  switch (sortBy) {
    case "customerName":
      return [{ user: { fullName: order } }, { createdAt: "desc" }];
    case "totalPrice":
      return [{ totalPrice: order }, { createdAt: "desc" }];
    case "bookingStatus":
      return [{ bookingStatus: order }, { createdAt: "desc" }];
    case "paymentStatus":
      return [{ paymentStatus: order }, { createdAt: "desc" }];
    default:
      return [{ bookingDate: order }, { startTime: order }, { createdAt: "desc" }];
  }
}

async function ensureAllowCommentsColumn() {
  if (await columnExists("blog_posts", "allow_comments")) return;

  await prisma.$executeRaw`
    alter table blog_posts
    add column if not exists allow_comments boolean not null default true
  `;
  columnExistsCache.set("blog_posts.allow_comments", true);
}

async function ensureCourtDepositColumn() {
  if (await columnExists("courts", "deposit_percent")) return;

  await prisma.$executeRaw`
    alter table courts
    add column if not exists deposit_percent numeric(5, 2) null
  `;
  columnExistsCache.set("courts.deposit_percent", true);
}

function shortUserId() {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `u${randomPart}${Date.now().toString(36).slice(-8)}`.slice(0, 20);
}

async function attachCourtDeposit<T extends { id: string }>(court: T | null) {
  if (!court) return court;
  await ensureCourtDepositColumn();
  const [row] = await prisma.$queryRaw<Array<{ depositPercent: number | null }>>`
    select deposit_percent::float as "depositPercent"
    from courts
    where id = ${court.id}
    limit 1
  `;
  return { ...court, depositPercent: row?.depositPercent ?? null };
}

async function attachCourtDeposits<T extends { id: string }>(courts: T[]) {
  await ensureCourtDepositColumn();
  if (!courts.length) return courts;
  const rows = await prisma.$queryRaw<Array<{ id: string; depositPercent: number | null }>>`
    select id, deposit_percent::float as "depositPercent"
    from courts
    where id in (${Prisma.join(courts.map((court) => court.id))})
  `;
  const deposits = new Map(rows.map((row) => [row.id, row.depositPercent ?? null]));
  return courts.map((court) => ({ ...court, depositPercent: deposits.get(court.id) ?? null }));
}

async function ensureCourtSurfaces<T extends { id: string; courtCount: number; surfaces: Array<{ code: string; sortOrder: number }> }>(court: T): Promise<T> {
  const target = court.courtCount ?? 1;
  const existing = court.surfaces ?? [];
  if (existing.length >= target) return court;

  const existingCodes = new Set(existing.map((surface) => surface.code));
  const nextSortOrder = existing.reduce((max, surface) => Math.max(max, surface.sortOrder), -1) + 1;
  const rowsToCreate: Prisma.CourtSurfaceUncheckedCreateInput[] = [];
  let candidate = existing.length + 1;
  while (rowsToCreate.length < target - existing.length) {
    const code = String(candidate).padStart(2, "0");
    if (!existingCodes.has(code)) {
      rowsToCreate.push({
        courtId: court.id,
        code,
        name: `Sân ${candidate}`,
        sortOrder: nextSortOrder + rowsToCreate.length
      });
      existingCodes.add(code);
    }
    candidate += 1;
  }

  const created = await prisma.$transaction(rowsToCreate.map((data) => prisma.courtSurface.create({ data })));
  return { ...court, surfaces: [...existing, ...created] };
}

export const partnerRepository = {
  profileByUser(userId: string) {
    return prisma.partnerProfile.findUnique({
      where: { userId },
      include: { user: { select: { fullName: true, email: true, phone: true, avatarUrl: true } } }
    });
  },

  dashboard(partnerId: string) {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const previousMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    return Promise.all([
      prisma.court.count({ where: { partnerId, activeStatus: "ACTIVE" } }),
      prisma.booking.count({ where: { court: { partnerId }, bookingDate: today } }),
      prisma.commissionTransaction.aggregate({
        where: { partnerId, createdAt: { gte: monthStart } },
        _sum: { netAmount: true }
      }),
      prisma.booking.count({ where: { court: { partnerId }, bookingStatus: "PENDING" } }),
      prisma.booking.findMany({
        where: { court: { partnerId }, bookingDate: { gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6)) } },
        select: { bookingDate: true },
        orderBy: { bookingDate: "asc" }
      }),
      prisma.court.findMany({
        where: { partnerId, activeStatus: "ACTIVE" },
        select: {
          id: true,
          name: true,
          bookings: {
            where: { bookingDate: today, bookingStatus: { in: ["PENDING", "CONFIRMED"] } },
            select: { bookingStatus: true, startTime: true, endTime: true },
            orderBy: { startTime: "asc" },
            take: 1
          }
        },
        orderBy: { name: "asc" },
        take: 5
      }),
      prisma.booking.findMany({
        where: { court: { partnerId } },
        include: { user: { select: { fullName: true } }, court: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 5
      }),
      prisma.commissionTransaction.aggregate({
        where: { partnerId, createdAt: { gte: previousMonthStart, lt: monthStart } },
        _sum: { netAmount: true }
      })
    ]);
  },

  updateProfile(id: string, data: Prisma.PartnerProfileUpdateInput) {
    return prisma.partnerProfile.update({
      where: { id },
      data,
      include: { user: { select: { fullName: true, email: true, phone: true, avatarUrl: true } } }
    });
  },

  async listCourts(partnerId: string) {
    const courts = await prisma.court.findMany({
      where: { partnerId },
      select: {
        id: true,
        name: true,
        district: true,
        city: true,
        openingTime: true,
        closingTime: true,
        approvalStatus: true,
        activeStatus: true,
        verified: true,
        category: { select: { name: true } },
        images: { select: { imageUrl: true }, take: 1, orderBy: { sortOrder: "asc" } },
        _count: { select: { surfaces: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    return attachCourtDeposits(courts);
  },

  async courtByPartner(courtId: string, partnerId: string) {
    const court = await prisma.court.findFirst({
      where: { id: courtId, partnerId },
      include: { category: true, images: true, prices: true, services: true, surfaces: { orderBy: [{ sortOrder: "asc" }, { code: "asc" }] } }
    });
    if (!court) return null;
    return attachCourtDeposit(await ensureCourtSurfaces(court));
  },

  async createCourt(data: Prisma.CourtUncheckedCreateInput, depositPercent?: number | null) {
    const court = await prisma.court.create({ data, include: { category: true } });
    await this.updateCourtDeposit(court.id, depositPercent);
    return attachCourtDeposit(court);
  },

  async updateCourt(id: string, data: Prisma.CourtUpdateInput, depositPercent?: number | null) {
    const court = await prisma.court.update({ where: { id }, data, include: { category: true, images: true, prices: true, services: true } });
    if (depositPercent !== undefined) await this.updateCourtDeposit(id, depositPercent);
    return attachCourtDeposit(court);
  },

  async updateCourtDeposit(id: string, depositPercent?: number | null) {
    await ensureCourtDepositColumn();
    const normalized = depositPercent && depositPercent > 0 ? depositPercent : null;
    await prisma.$executeRaw`
      update courts
      set deposit_percent = ${normalized}
      where id = ${id}
    `;
  },

  addImage(data: Prisma.CourtImageUncheckedCreateInput) {
    return prisma.courtImage.create({ data });
  },

  imageByPartner(imageId: string, partnerId: string) {
    return prisma.courtImage.findFirst({ where: { id: imageId, court: { partnerId } } });
  },

  deleteImage(imageId: string) {
    return prisma.courtImage.delete({ where: { id: imageId } });
  },

  async reorderImages(courtId: string, imageIds: string[]) {
    return prisma.$transaction(
      imageIds.map((id, sortOrder) =>
        prisma.courtImage.updateMany({ where: { id, courtId }, data: { sortOrder } })
      )
    );
  },

  addPrice(data: Prisma.CourtPriceUncheckedCreateInput) {
    return prisma.courtPrice.create({ data });
  },

  priceByPartner(priceId: string, partnerId: string) {
    return prisma.courtPrice.findFirst({ where: { id: priceId, court: { partnerId } } });
  },

  updatePrice(priceId: string, data: Prisma.CourtPriceUpdateInput) {
    return prisma.courtPrice.update({ where: { id: priceId }, data });
  },

  deletePrice(priceId: string) {
    return prisma.courtPrice.delete({ where: { id: priceId } });
  },

  addService(data: Prisma.CourtServiceUncheckedCreateInput) {
    return prisma.courtService.create({ data });
  },

  serviceByPartner(serviceId: string, partnerId: string) {
    return prisma.courtService.findFirst({ where: { id: serviceId, court: { partnerId } } });
  },

  updateService(serviceId: string, data: Prisma.CourtServiceUpdateInput) {
    return prisma.courtService.update({ where: { id: serviceId }, data });
  },

  deleteService(serviceId: string) {
    return prisma.courtService.update({ where: { id: serviceId }, data: { status: "INACTIVE" } });
  },

  bookingWhere(
    partnerId: string,
    filters: { courtId?: string; status?: BookingStatus; search?: string; fromDate?: Date; toDate?: Date }
  ): Prisma.BookingWhereInput {
    return {
      court: { partnerId },
      courtId: filters.courtId,
      bookingStatus: filters.status,
      bookingDate:
        filters.fromDate || filters.toDate
          ? { gte: filters.fromDate, lte: filters.toDate }
          : undefined,
      OR: filters.search
        ? [
            { bookingCode: { contains: filters.search, mode: "insensitive" } },
            { user: { fullName: { contains: filters.search, mode: "insensitive" } } },
            { user: { phone: { contains: filters.search, mode: "insensitive" } } }
          ]
        : undefined
    };
  },

  bookingMatchingRows(where: Prisma.BookingWhereInput, sortBy?: string, sortOrder?: string) {
    return prisma.booking.findMany({
      where,
      orderBy: bookingOrderBy(sortBy, sortOrder),
      select: { id: true, bookingOrderId: true }
    });
  },

  async bookingsByOrderIds(partnerId: string, orderIds: string[]) {
    const bookings = await prisma.booking.findMany({
      where: { court: { partnerId }, bookingOrderId: { in: orderIds } },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true } },
        court: true,
        courtSurface: { select: { id: true, name: true, code: true } },
        bookingServices: { include: { service: true, courtService: true } }
      },
      orderBy: [{ bookingDate: "asc" }, { startTime: "asc" }]
    });
    return bookings.map(normalizeBookingServices);
  },

  async bookingsByIds(partnerId: string, ids: string[]) {
    const bookings = await prisma.booking.findMany({
      where: { court: { partnerId }, id: { in: ids } },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true } },
        court: true,
        courtSurface: { select: { id: true, name: true, code: true } },
        bookingServices: { include: { service: true, courtService: true } }
      }
    });
    return bookings.map(normalizeBookingServices);
  },

  bookingByPartner(bookingId: string, partnerId: string) {
    return prisma.booking.findFirst({
      where: { id: bookingId, court: { partnerId } },
      include: { court: { include: { partner: true } } }
    });
  },

  calendar(partnerId: string, fromDate: Date, toDate: Date, courtId: string) {
    return prisma.booking.findMany({
      where: {
        court: { partnerId },
        courtId,
        bookingDate: { gte: fromDate, lte: toDate }
      },
      include: {
        user: { select: { fullName: true, phone: true } },
        court: { select: { id: true, name: true } },
        courtSurface: { select: { id: true, name: true, code: true } }
      },
      orderBy: [{ bookingDate: "asc" }, { startTime: "asc" }]
    });
  },

  courtSurfaces(courtId: string) {
    return prisma.courtSurface.findMany({
      where: { courtId },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }]
    });
  },

  courtSurfaceByPartner(surfaceId: string, courtId: string, partnerId: string) {
    return prisma.courtSurface.findFirst({
      where: { id: surfaceId, courtId, court: { partnerId } }
    });
  },

  updateCourtSurfaceStatus(surfaceId: string, status: "ACTIVE" | "INACTIVE") {
    return prisma.courtSurface.update({ where: { id: surfaceId }, data: { status } });
  },

  updateCourtSurface(surfaceId: string, data: { openingTime?: Date | null; closingTime?: Date | null }) {
    return prisma.courtSurface.update({ where: { id: surfaceId }, data });
  },

  courtBlocks(courtId: string) {
    return prisma.courtAvailabilityBlock.findMany({
      where: { courtId, status: "ACTIVE" },
      include: { courtSurface: { select: { id: true, name: true, code: true } } },
      orderBy: [{ blockDate: "asc" }, { startTime: "asc" }]
    });
  },

  courtDayBookings(courtId: string, date: Date) {
    return prisma.booking.findMany({
      where: {
        courtId,
        bookingDate: date,
        bookingStatus: { notIn: ["CANCELLED", "NO_SHOW"] }
      },
      select: { id: true, startTime: true, endTime: true, bookingStatus: true, courtSurfaceId: true, payments: { select: { expiresAt: true, status: true } } },
      orderBy: { startTime: "asc" }
    });
  },

  courtDayBookingSlots(courtId: string, date: Date) {
    return prisma.bookingSlot.findMany({
      where: {
        courtId,
        bookingDate: date,
        booking: { bookingStatus: { notIn: ["CANCELLED", "NO_SHOW"] } }
      },
      select: {
        id: true,
        bookingId: true,
        startTime: true,
        endTime: true,
        court_surface_id: true,
        booking: { select: { bookingStatus: true, payments: { select: { expiresAt: true, status: true } } } }
      },
      orderBy: { startTime: "asc" }
    });
  },

  courtDayBlocks(courtId: string, date: Date) {
    return prisma.courtAvailabilityBlock.findMany({
      where: { courtId, blockDate: date, status: "ACTIVE" },
      select: { id: true, startTime: true, endTime: true, reason: true, courtSurfaceId: true },
      orderBy: { startTime: "asc" }
    });
  },

  createCourtBlock(data: Prisma.CourtAvailabilityBlockUncheckedCreateInput) {
    return prisma.courtAvailabilityBlock.create({ data });
  },

  createCourtBlocks(data: Prisma.CourtAvailabilityBlockCreateManyInput[]) {
    return prisma.courtAvailabilityBlock.createMany({ data });
  },

  blockByCourtAndPartner(blockId: string, courtId: string, partnerId: string) {
    return prisma.courtAvailabilityBlock.findFirst({
      where: { id: blockId, courtId, court: { partnerId } }
    });
  },

  cancelCourtBlock(blockId: string) {
    return prisma.courtAvailabilityBlock.update({ where: { id: blockId }, data: { status: "INACTIVE" } });
  },

  updateBookingStatus(bookingId: string, status: BookingStatus) {
    return prisma.booking.update({ where: { id: bookingId }, data: { bookingStatus: status } });
  },

  revenue(partnerId: string) {
    return prisma.booking.groupBy({
      by: ["bookingStatus"],
      where: { court: { partnerId } },
      _sum: { totalPrice: true },
      _count: true
    });
  },

  setCourtApproval(id: string, approvalStatus: ApprovalStatus) {
    return prisma.court.update({ where: { id }, data: { approvalStatus } });
  },

  async listBlogs(userId: string) {
    const allowCommentsSelect = await columnExists("blog_posts", "allow_comments")
      ? Prisma.sql`coalesce(allow_comments, true)`
      : Prisma.sql`true`;

    return prisma.$queryRaw<any[]>(Prisma.sql`
      select b.id, b.title, b.slug, b.excerpt, b.content, b.cover_image_url as "coverImageUrl",
        b.status::text, b.visibility::text, b.created_at as "createdAt", b.updated_at as "updatedAt",
        b.published_at as "publishedAt", ${allowCommentsSelect} as "allowComments",
        reject_reason.reason as "rejectionReason"
      from blog_posts b
      left join lateral (
        select mh.reason from moderation_history mh
        where mh.entity_type = 'BLOG' and mh.entity_id = b.id and mh.action = 'REJECTED'
        order by mh.created_at desc
        limit 1
      ) reject_reason on true
      where b.author_id = ${userId} order by b.created_at desc
    `);
  },

  async findBlog(id: string, userId: string) {
    const allowCommentsSelect = await columnExists("blog_posts", "allow_comments")
      ? Prisma.sql`coalesce(allow_comments, true)`
      : Prisma.sql`true`;

    return prisma.$queryRaw<any[]>(Prisma.sql`
      select b.id, b.title, b.slug, b.excerpt, b.content, b.cover_image_url as "coverImageUrl",
        b.status::text, b.visibility::text, b.created_at as "createdAt", b.updated_at as "updatedAt",
        b.published_at as "publishedAt", ${allowCommentsSelect} as "allowComments",
        reject_reason.reason as "rejectionReason"
      from blog_posts b
      left join lateral (
        select mh.reason from moderation_history mh
        where mh.entity_type = 'BLOG' and mh.entity_id = b.id and mh.action = 'REJECTED'
        order by mh.created_at desc
        limit 1
      ) reject_reason on true
      where b.id = ${id} and b.author_id = ${userId} limit 1
    `);
  },

  async createBlog(userId: string, input: any) {
    await ensureAllowCommentsColumn();

    return prisma.$queryRaw<any[]>`
      insert into blog_posts (author_id, title, slug, excerpt, content, cover_image_url, visibility, status, allow_comments)
      values (${userId}, ${input.title}, ${input.slug}, ${input.excerpt ?? null},
        ${input.content}, ${input.coverImageUrl || null}, ${input.visibility}::blog_visibility, 'DRAFT'::blog_post_status,
        ${input.allowComments ?? true})
      returning id, title, slug, excerpt, content, cover_image_url as "coverImageUrl",
        status::text, visibility::text, coalesce(allow_comments, true) as "allowComments",
        created_at as "createdAt", updated_at as "updatedAt"
    `;
  },

  async updateBlog(id: string, userId: string, input: any) {
    await ensureAllowCommentsColumn();

    return prisma.$queryRaw<any[]>`
      update blog_posts set title = ${input.title}, slug = ${input.slug}, excerpt = ${input.excerpt ?? null},
        content = ${input.content}, cover_image_url = ${input.coverImageUrl || null},
        visibility = ${input.visibility}::blog_visibility, allow_comments = ${input.allowComments ?? true}, updated_at = now()
      where id = ${id} and author_id = ${userId} and status = 'DRAFT'::blog_post_status
      returning id, title, slug, excerpt, content, cover_image_url as "coverImageUrl",
        status::text, visibility::text, coalesce(allow_comments, true) as "allowComments",
        created_at as "createdAt", updated_at as "updatedAt"
    `;
  },

  async updateBlogComments(id: string, userId: string, allowComments: boolean) {
    await ensureAllowCommentsColumn();

    return prisma.$queryRaw<any[]>`
      update blog_posts set allow_comments = ${allowComments}, updated_at = now()
      where id = ${id} and author_id = ${userId}
      returning id, title, slug, excerpt, content, cover_image_url as "coverImageUrl",
        status::text, visibility::text, coalesce(allow_comments, true) as "allowComments",
        created_at as "createdAt", updated_at as "updatedAt", published_at as "publishedAt"
    `;
  },

  submitBlog(id: string, userId: string) {
    return prisma.$executeRaw`
      update blog_posts set status = 'PENDING'::blog_post_status, updated_at = now()
      where id = ${id} and author_id = ${userId} and status = 'DRAFT'::blog_post_status
    `;
  },

  deleteBlog(id: string, userId: string) {
    return prisma.$executeRaw`
      delete from blog_posts where id = ${id} and author_id = ${userId}
        and status = 'DRAFT'::blog_post_status
    `;
  },

  listRecipients(partnerId: string) {
    return prisma.$queryRaw`
      select
        u.id,
        u.full_name as "fullName",
        u.email,
        u.phone,
        u.status,
        u.managed_court_id as "managedCourtId",
        case when c.id is null then null else jsonb_build_object('id', c.id, 'name', c.name) end as "managedCourt"
      from users u
      left join courts c on c.id = u.managed_court_id
      where u.partner_id = ${partnerId}
        and u.role = 'RECIPIENT'::user_role
      order by u.full_name asc
    `;
  },

  findRecipient(id: string, partnerId: string) {
    return prisma.$queryRaw`
      select
        id,
        full_name as "fullName",
        email,
        phone,
        status,
        managed_court_id as "managedCourtId"
      from users
      where id = ${id}
        and partner_id = ${partnerId}
        and role = 'RECIPIENT'::user_role
      limit 1
    `.then((rows: any) => rows[0] ?? null);
  },

  createRecipient(partnerId: string, data: { fullName: string; email: string; passwordHash: string; phone?: string; managedCourtId: string }) {
    return prisma.$queryRaw`
      insert into users (
        id, full_name, email, password_hash, phone, role, status,
        email_verified, partner_id, managed_court_id
      ) values (
        ${shortUserId()},
        ${data.fullName},
        ${data.email},
        ${data.passwordHash},
        ${data.phone ?? null},
        'RECIPIENT'::user_role,
        'ACTIVE'::account_status,
        true,
        ${partnerId},
        ${data.managedCourtId}
      )
      returning
        id,
        full_name as "fullName",
        email,
        phone,
        status,
        managed_court_id as "managedCourtId"
    `.then((rows: any) => rows[0]);
  },

  updateRecipient(id: string, partnerId: string, data: { fullName?: string; passwordHash?: string; phone?: string; managedCourtId?: string }) {
    return prisma.$queryRaw`
      update users
      set
        full_name = coalesce(${data.fullName ?? null}, full_name),
        password_hash = coalesce(${data.passwordHash ?? null}, password_hash),
        phone = coalesce(${data.phone ?? null}, phone),
        managed_court_id = coalesce(${data.managedCourtId ?? null}, managed_court_id),
        updated_at = now()
      where id = ${id}
        and partner_id = ${partnerId}
        and role = 'RECIPIENT'::user_role
      returning
        id,
        full_name as "fullName",
        email,
        phone,
        status,
        managed_court_id as "managedCourtId"
    `.then((rows: any) => rows[0] ?? null);
  },

  deleteRecipient(id: string, partnerId: string) {
    return prisma.$executeRaw`
      delete from users
      where id = ${id}
        and partner_id = ${partnerId}
        and role = 'RECIPIENT'::user_role
    `;
  }
};
