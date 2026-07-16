import { Prisma, type ApprovalStatus, type BookingStatus } from "@prisma/client";
import { prisma } from "../../config/db.js";

const columnExistsCache = new Map<string, boolean>();

async function columnExists(tableName: string, columnName: string) {
  const cacheKey = `${tableName}.${columnName}`;
  const cached = columnExistsCache.get(cacheKey);
  if (cached !== undefined) return cached;

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
    return prisma.$transaction([
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
      include: { category: true, images: true, prices: true, services: true },
      orderBy: { createdAt: "desc" }
    });
    return attachCourtDeposits(courts);
  },

  async courtByPartner(courtId: string, partnerId: string) {
    const court = await prisma.court.findFirst({
      where: { id: courtId, partnerId },
      include: { category: true, images: true, prices: true, services: true }
    });
    return attachCourtDeposit(court);
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

  bookings(
    partnerId: string,
    page: number,
    limit: number,
    filters: { courtId?: string; status?: BookingStatus; fromDate?: Date; toDate?: Date }
  ) {
    const where: Prisma.BookingWhereInput = {
      court: { partnerId },
      courtId: filters.courtId,
      bookingStatus: filters.status,
      bookingDate:
        filters.fromDate || filters.toDate
          ? { gte: filters.fromDate, lte: filters.toDate }
          : undefined
    };
    return prisma.$transaction([
      prisma.booking.findMany({
        where,
        include: { user: { select: { id: true, fullName: true, email: true, phone: true } }, court: true },
        orderBy: [{ bookingDate: "desc" }, { startTime: "asc" }],
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.booking.count({ where })
    ]);
  },

  bookingByPartner(bookingId: string, partnerId: string) {
    return prisma.booking.findFirst({
      where: { id: bookingId, court: { partnerId } },
      include: { court: { include: { partner: true } } }
    });
  },

  calendar(partnerId: string, fromDate: Date, toDate: Date, courtId?: string) {
    return prisma.booking.findMany({
      where: {
        court: { partnerId },
        courtId,
        bookingDate: { gte: fromDate, lte: toDate },
        bookingStatus: { not: "CANCELLED" }
      },
      include: {
        user: { select: { fullName: true, phone: true } },
        court: { select: { id: true, name: true } }
      },
      orderBy: [{ bookingDate: "asc" }, { startTime: "asc" }]
    });
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

  listTournaments(partnerId: string) {
    return prisma.$queryRaw<any[]>`
      select t.id, t.court_id as "courtId", t.title, t.slug, t.description,
        t.sport_type as "sportType", t.cover_image_url as "coverImageUrl",
        t.start_date as "startDate", t.end_date as "endDate",
        t.registration_deadline as "registrationDeadline", t.max_participants as "maxParticipants",


        t.current_participants as "currentParticipants", t.entry_fee::float as "entryFee",
        t.prize_description as "prizeDescription", t.status::text,
        t.created_at as "createdAt", c.name as "courtName"
      from tournaments t join courts c on c.id = t.court_id
      where t.partner_id = ${partnerId}::uuid order by t.created_at desc
    `;
  },

  findTournament(id: string, partnerId: string) {
    return prisma.$queryRaw<any[]>`
      select t.id, t.court_id as "courtId", t.title, t.slug, t.description,
        t.sport_type as "sportType", t.cover_image_url as "coverImageUrl",
        t.start_date as "startDate", t.end_date as "endDate",
        t.registration_deadline as "registrationDeadline", t.max_participants as "maxParticipants",
        t.current_participants as "currentParticipants", t.entry_fee::float as "entryFee",
        t.prize_description as "prizeDescription", t.status::text,
        t.created_at as "createdAt", c.name as "courtName"
      from tournaments t join courts c on c.id = t.court_id
      where t.id = ${id}::uuid and t.partner_id = ${partnerId}::uuid limit 1
    `;
  },

  createTournament(partnerId: string, input: any) {
    return prisma.$queryRaw<any[]>`
      insert into tournaments (
        partner_id, court_id, title, slug, description, sport_type, cover_image_url,
        start_date, end_date, registration_deadline, max_participants, entry_fee,
        prize_description, status
      ) values (
        ${partnerId}::uuid, ${input.courtId}::uuid, ${input.title}, ${input.slug},
        ${input.description ?? null}, ${input.sportType}, ${input.coverImageUrl || null},
        ${input.startDate}::timestamptz, ${input.endDate}::timestamptz,
        ${input.registrationDeadline}::timestamptz, ${input.maxParticipants},
        ${input.entryFee}, ${input.prizeDescription ?? null}, 'DRAFT'::tournament_status
      ) returning id
    `;
  },

  updateTournament(id: string, partnerId: string, input: any) {
    return prisma.$executeRaw`
      update tournaments set court_id = ${input.courtId}::uuid, title = ${input.title},
        slug = ${input.slug}, description = ${input.description ?? null},
        sport_type = ${input.sportType}, cover_image_url = ${input.coverImageUrl || null},
        start_date = ${input.startDate}::timestamptz, end_date = ${input.endDate}::timestamptz,
        registration_deadline = ${input.registrationDeadline}::timestamptz,
        max_participants = ${input.maxParticipants}, entry_fee = ${input.entryFee},
        prize_description = ${input.prizeDescription ?? null}, updated_at = now()
      where id = ${id}::uuid and partner_id = ${partnerId}::uuid and status = 'DRAFT'::tournament_status
    `;
  },

  submitTournament(id: string, partnerId: string) {
    return prisma.$executeRaw`
      update tournaments set status = 'PENDING'::tournament_status, updated_at = now()
      where id = ${id}::uuid and partner_id = ${partnerId}::uuid and status = 'DRAFT'::tournament_status
    `;
  },

  deleteTournament(id: string, partnerId: string) {
    return prisma.$executeRaw`
      delete from tournaments where id = ${id}::uuid and partner_id = ${partnerId}::uuid
        and status = 'DRAFT'::tournament_status
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
