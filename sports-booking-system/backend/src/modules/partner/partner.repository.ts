import type { ApprovalStatus, BookingStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";

export const partnerRepository = {
  profileByUser(userId: string) {
    return prisma.partnerProfile.findUnique({
      where: { userId },
      include: { user: { select: { fullName: true, email: true, phone: true, avatarUrl: true } } }
    });
  },

  findWalkInUser(phone: string) {
    return prisma.user.findFirst({
      where: {
        role: "USER",
        OR: [
          { phone },
          { email: `walkin_${phone}@sportsbooking.local` }
        ]
      }
    });
  },

  createWalkInUser(input: { fullName: string; phone: string }) {
    return prisma.user.create({
      data: {
        fullName: input.fullName,
        phone: input.phone,
        email: `walkin_${input.phone}@sportsbooking.local`,
        role: "USER",
        provider: "LOCAL",
        emailVerified: false,
        status: "ACTIVE"
      }
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

  listCourts(partnerId: string) {
    return prisma.court.findMany({
      where: { partnerId },
      include: { category: true, images: true, prices: true, services: true, surfaces: { where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" } } },
      orderBy: { createdAt: "desc" }
    });
  },

  courtByPartner(courtId: string, partnerId: string) {
    return prisma.court.findFirst({
      where: { id: courtId, partnerId },
      include: { category: true, images: true, prices: true, services: true, surfaces: { where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" } } }
    });
  },

  courtSurfaceByPartner(courtSurfaceId: string, partnerId: string) {
    return prisma.courtSurface.findFirst({
      where: { id: courtSurfaceId, status: "ACTIVE", court: { partnerId } },
      include: { court: { include: { category: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } } } }
    });
  },

  createCourt(data: Prisma.CourtUncheckedCreateInput) {
    return prisma.court.create({ data, include: { category: true } });
  },

  updateCourt(id: string, data: Prisma.CourtUpdateInput) {
    return prisma.court.update({ where: { id }, data, include: { category: true, images: true, prices: true, services: true } });
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
      include: { court: { include: { partner: true } }, courtSurface: true }
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

  operationCourts(partnerId: string, date: Date) {
    return prisma.court.findMany({
      where: { partnerId },
      include: {
        category: true,
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
        surfaces: { where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" } },
        bookings: {
          where: {
            bookingDate: date,
            bookingStatus: { in: ["PENDING", "CONFIRMED"] }
          },
          include: { user: { select: { id: true, fullName: true, phone: true, email: true } }, courtSurface: true },
          orderBy: { startTime: "asc" }
        }
      },
      orderBy: { name: "asc" }
    });
  },

  findScheduleConflict(courtId: string, courtSurfaceId: string | null | undefined, date: Date, startTime: Date, endTime: Date, excludeBookingId?: string) {
    return prisma.booking.findFirst({
      where: {
        id: excludeBookingId ? { not: excludeBookingId } : undefined,
        courtId,
        OR: courtSurfaceId ? [{ courtSurfaceId }, { courtSurfaceId: null }] : undefined,
        bookingDate: date,
        bookingStatus: { in: ["PENDING", "CONFIRMED"] },
        startTime: { lt: endTime },
        endTime: { gt: startTime }
      },
      include: { user: { select: { fullName: true, phone: true } }, court: { select: { id: true, name: true } } }
    });
  },

  extendBooking(bookingId: string, endTime: Date, pricing: { basePrice: number; dynamicAdjustmentAmount: number; subtotal: number; totalPrice: number }) {
    return prisma.booking.update({
      where: { id: bookingId },
      data: {
        endTime,
        basePrice: { increment: pricing.basePrice },
        dynamicAdjustmentAmount: { increment: pricing.dynamicAdjustmentAmount },
        subtotal: { increment: pricing.subtotal },
        totalPrice: { increment: pricing.totalPrice }
      },
      include: { court: true, user: { select: { id: true, fullName: true, phone: true } } }
    });
  },

  earlyCheckInBooking(bookingId: string, oldStartTime: Date, startTime: Date, pricing: { basePrice: number; dynamicAdjustmentAmount: number; subtotal: number; totalPrice: number }) {
    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          startTime,
          basePrice: { increment: pricing.basePrice },
          dynamicAdjustmentAmount: { increment: pricing.dynamicAdjustmentAmount },
          subtotal: { increment: pricing.subtotal },
          totalPrice: { increment: pricing.totalPrice }
        },
        include: { court: true, user: { select: { id: true, fullName: true, phone: true } } }
      });

      await tx.bookingSlot.updateMany({
        where: { bookingId, startTime: oldStartTime },
        data: {
          startTime,
          slotPrice: { increment: pricing.totalPrice }
        }
      });

      return booking;
    });
  },

  createContinuationBooking(input: {
    bookingCode: string;
    userId: string;
    courtId: string;
    courtSurfaceId?: string | null;
    bookingDate: Date;
    startTime: Date;
    endTime: Date;
    basePrice: number;
    dynamicAdjustmentAmount: number;
    subtotal: number;
    totalPrice: number;
    note: string;
    paymentMethod?: "CASH" | "BANK_TRANSFER" | "E_WALLET";
  }) {
    return prisma.booking.create({
      data: {
        bookingCode: input.bookingCode,
        userId: input.userId,
        courtId: input.courtId,
        courtSurfaceId: input.courtSurfaceId ?? undefined,
        bookingDate: input.bookingDate,
        startTime: input.startTime,
        endTime: input.endTime,
        basePrice: input.basePrice,
        dynamicAdjustmentAmount: input.dynamicAdjustmentAmount,
        subtotal: input.subtotal,
        totalPrice: input.totalPrice,
        depositAmount: 0,
        paymentMethod: input.paymentMethod ?? "CASH",
        paymentStatus: "UNPAID",
        bookingStatus: "CONFIRMED",
        note: input.note
      },
      include: { court: true, user: { select: { id: true, fullName: true, phone: true } } }
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

  listBlogs(userId: string) {
    return prisma.$queryRaw<any[]>`
      select id, title, slug, excerpt, content, cover_image_url as "coverImageUrl",
        status::text, visibility::text, created_at as "createdAt", updated_at as "updatedAt",
        published_at as "publishedAt"
      from blog_posts where author_id = ${userId}::uuid order by created_at desc
    `;
  },

  findBlog(id: string, userId: string) {
    return prisma.$queryRaw<any[]>`
      select id, title, slug, excerpt, content, cover_image_url as "coverImageUrl",
        status::text, visibility::text, created_at as "createdAt", updated_at as "updatedAt",
        published_at as "publishedAt"
      from blog_posts where id = ${id}::uuid and author_id = ${userId}::uuid limit 1
    `;
  },

  createBlog(userId: string, input: any) {
    return prisma.$queryRaw<any[]>`
      insert into blog_posts (author_id, title, slug, excerpt, content, cover_image_url, visibility, status)
      values (${userId}::uuid, ${input.title}, ${input.slug}, ${input.excerpt ?? null},
        ${input.content}, ${input.coverImageUrl || null}, ${input.visibility}::blog_visibility, 'DRAFT'::blog_post_status)
      returning id, title, slug, excerpt, content, cover_image_url as "coverImageUrl",
        status::text, visibility::text, created_at as "createdAt", updated_at as "updatedAt"
    `;
  },

  updateBlog(id: string, userId: string, input: any) {
    return prisma.$queryRaw<any[]>`
      update blog_posts set title = ${input.title}, slug = ${input.slug}, excerpt = ${input.excerpt ?? null},
        content = ${input.content}, cover_image_url = ${input.coverImageUrl || null},
        visibility = ${input.visibility}::blog_visibility, updated_at = now()
      where id = ${id}::uuid and author_id = ${userId}::uuid and status = 'DRAFT'::blog_post_status
      returning id, title, slug, excerpt, content, cover_image_url as "coverImageUrl",
        status::text, visibility::text, created_at as "createdAt", updated_at as "updatedAt"
    `;
  },

  submitBlog(id: string, userId: string) {
    return prisma.$executeRaw`
      update blog_posts set status = 'PENDING'::blog_post_status, updated_at = now()
      where id = ${id}::uuid and author_id = ${userId}::uuid and status = 'DRAFT'::blog_post_status
    `;
  },

  deleteBlog(id: string, userId: string) {
    return prisma.$executeRaw`
      delete from blog_posts where id = ${id}::uuid and author_id = ${userId}::uuid
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
  }
};
