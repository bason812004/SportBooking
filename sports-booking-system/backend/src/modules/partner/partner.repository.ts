import { Prisma, type ApprovalStatus, type BookingStatus } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { normalizeBookingServices } from "../../shared/utils/bookingServices.js";
import { ConflictError, NotFoundError } from "../../shared/errors/AppError.js";
import { surfaceCode, surfaceName, normalizedSurfaceCode } from "../../shared/utils/courtSurface.js";

const columnExistsCache = new Map<string, boolean>([
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
  // Serialize legacy auto-fill with explicit add/delete operations. Re-read the
  // count after locking so a stale detail request cannot recreate a deleted row.
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM courts WHERE id = ${court.id} FOR UPDATE`;
    const current = await tx.court.findUniqueOrThrow({ where: { id: court.id } });
    const existing = await tx.courtSurface.findMany({ where: { courtId: court.id }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] });
    const target = current.courtCount;
    const codes = new Set(existing.map((row) => normalizedSurfaceCode(row.code)));
    let candidate = 1;
    let sortOrder = existing.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;
    while (existing.length < target) {
      const number = candidate++;
      const code = surfaceCode(number);
      if (codes.has(code)) continue;
      existing.push(await tx.courtSurface.create({ data: {
        courtId: court.id, code, name: surfaceName(current.name, number), sortOrder: sortOrder++
      } }));
      codes.add(code);
    }
    return { ...court, courtCount: target, surfaces: existing };
  });
}

export type NewCourtSurface = { name: string; surface?: string | null; size?: string | null };

function normalizeDeposit(depositPercent?: number | null) {
  return depositPercent && depositPercent > 0 ? depositPercent : null;
}

/**
 * Creates a court and its sub-courts (codes S01..SNN in the given order) inside the caller's transaction.
 * courtCount matches the sub-courts so ensureCourtSurfaces never pads them; one createManyAndReturn keeps a
 * 30-sub-court court to a couple of round-trips, well inside the 20s Supabase transaction budget.
 */
async function createCourtTx(
  tx: Prisma.TransactionClient,
  data: Prisma.CourtUncheckedCreateInput,
  depositPercent: number | null,
  surfaces: NewCourtSurface[]
) {
  const court = await tx.court.create({
    data: { ...data, courtCount: surfaces.length, deposit_percent: depositPercent },
    include: { category: true }
  });
  const rows = await tx.courtSurface.createManyAndReturn({
    data: surfaces.map((surface, index) => ({
      courtId: court.id,
      code: surfaceCode(index + 1),
      name: surface.name,
      surface: surface.surface ?? null,
      size: surface.size ?? null,
      sortOrder: index,
      status: "ACTIVE" as const
    }))
  });
  return { ...court, surfaces: [...rows].sort((a, b) => a.sortOrder - b.sortOrder), depositPercent };
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
    await ensureCourtDepositColumn();
    return prisma.$transaction((tx) => createCourtTx(tx, data, normalizeDeposit(depositPercent), [{ name: surfaceName(data.name, 1) }]));
  },

  /** A venue registered with several sports: one court per sport plus its sub-courts, all or nothing. */
  async createCourts(entries: Array<{ data: Prisma.CourtUncheckedCreateInput; surfaces: NewCourtSurface[] }>, depositPercent?: number | null) {
    await ensureCourtDepositColumn();
    const deposit = normalizeDeposit(depositPercent);
    return prisma.$transaction(
      async (tx) => {
        const courts = [];
        for (const entry of entries) courts.push(await createCourtTx(tx, entry.data, deposit, entry.surfaces));
        return courts;
      },
      { maxWait: 10000, timeout: 20000 }
    );
  },

  activeCategoriesByIds(ids: string[]) {
    return prisma.courtCategory.findMany({ where: { id: { in: ids }, status: "ACTIVE" }, select: { id: true, name: true, slug: true } });
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

  courtTimeChargePolicy(courtId: string, partnerId: string) {
    return prisma.court.findFirst({
      where: { id: courtId, partnerId },
      select: { earlyFreeMinutes: true, earlyMaxMinutes: true, earlyPricePercent: true, extensionPricePercent: true }
    });
  },

  updateCourtTimeChargePolicy(
    courtId: string,
    data: { earlyFreeMinutes: number; earlyMaxMinutes: number | null; earlyPricePercent: number; extensionPricePercent: number }
  ) {
    return prisma.court.update({
      where: { id: courtId },
      data,
      select: { earlyFreeMinutes: true, earlyMaxMinutes: true, earlyPricePercent: true, extensionPricePercent: true }
    });
  },

  addImage(data: Prisma.CourtImageUncheckedCreateInput) {
    return prisma.courtImage.create({ data });
  },

  imageByPartner(imageId: string, partnerId: string) {
    return prisma.courtImage.findFirst({ where: { id: imageId, court: { partnerId } } });
  },

  deleteImage(imageId: string) {
    return prisma.$transaction(async (tx) => {
      const image = await tx.courtImage.findUnique({ where: { id: imageId } });
      if (!image) throw new NotFoundError("Không tìm thấy ảnh sân");
      await tx.$queryRaw`SELECT id FROM courts WHERE id = ${image.courtId} FOR UPDATE`;
      if (await tx.courtImageRequest.findFirst({ where: { replaceImageId: imageId, status: "PENDING" } })) {
        throw new ConflictError("Ảnh đang chờ thay thế. Hãy hủy yêu cầu thay ảnh trước khi xóa.");
      }
      return tx.courtImage.delete({ where: { id: imageId } });
    });
  },

  async reorderImages(courtId: string, imageIds: string[]) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM courts WHERE id = ${courtId} FOR UPDATE`;
      if (await tx.courtImageRequest.findFirst({ where: { courtId, replaceImageId: { not: null }, status: "PENDING" } })) {
        throw new ConflictError("Hãy đợi duyệt hoặc hủy yêu cầu thay ảnh trước khi sắp xếp.");
      }
      for (const [sortOrder, id] of imageIds.entries()) {
        await tx.courtImage.updateMany({ where: { id, courtId }, data: { sortOrder } });
      }
    });
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

  async saveCourtSurface(courtId: string, surfaceId: string | null, data: Pick<Prisma.CourtSurfaceUncheckedCreateInput, "code" | "name" | "capacity" | "surface" | "size" | "openingTime" | "closingTime">) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM courts WHERE id = ${courtId} FOR UPDATE`;
      const duplicate = await tx.courtSurface.findFirst({ where: {
        courtId, code: { equals: data.code, mode: "insensitive" },
        ...(surfaceId ? { id: { not: surfaceId } } : {})
      } });
      if (duplicate) throw new ConflictError("Mã sân con đã tồn tại trong cụm sân này");
      const result = surfaceId
        ? await tx.courtSurface.update({ where: { id: surfaceId, courtId }, data })
        : await tx.courtSurface.create({ data: { ...data, courtId,
            sortOrder: ((await tx.courtSurface.aggregate({ where: { courtId }, _max: { sortOrder: true } }))._max.sortOrder ?? -1) + 1
          } });
      const courtCount = await tx.courtSurface.count({ where: { courtId } });
      await tx.court.update({ where: { id: courtId }, data: { courtCount } });
      return result;
    });
  },

  async deleteCourtSurface(courtId: string, surfaceId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM courts WHERE id = ${courtId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM court_surfaces WHERE id = ${surfaceId} AND court_id = ${courtId} FOR UPDATE`;
      const surface = await tx.courtSurface.findFirst({ where: { id: surfaceId, courtId }, include: {
        _count: { select: { bookings: true, booking_slots: true, bookingSeries: true, availabilityBlocks: true } }
      } });
      if (!surface) throw new NotFoundError("Không tìm thấy sân con");
      if (Object.values(surface._count).some((count) => count > 0)) {
        throw new ConflictError("Sân con đã có lịch đặt hoặc lịch nghỉ. Vui lòng tạm ngưng thay vì xóa.");
      }
      if (await tx.courtSurface.count({ where: { courtId } }) <= 1) {
        throw new ConflictError("Cụm sân cần ít nhất một sân con. Hãy thêm sân mới trước khi xóa hoặc tạm ngưng sân này.");
      }
      await tx.courtSurface.delete({ where: { id: surfaceId } });
      await tx.court.update({ where: { id: courtId }, data: { courtCount: await tx.courtSurface.count({ where: { courtId } }) } });
      return { id: surfaceId };
    });
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
