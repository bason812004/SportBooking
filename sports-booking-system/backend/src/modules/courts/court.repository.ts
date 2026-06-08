import { BookingStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { toDbDate, timeToDate } from "../../shared/utils/time.js";
import type { CourtListQuery } from "./court.types.js";

const courtInclude = {
  category: true,
  images: { orderBy: { sortOrder: "asc" as const } },
  surfaces: { where: { status: "ACTIVE" as const }, orderBy: { sortOrder: "asc" as const } },
  amenities: true,
  prices: true,
  services: { where: { status: "ACTIVE" as const } },
  reviews: { where: { displayStatus: "VISIBLE" as const }, select: { rating: true } },
  partner: { include: { user: { select: { fullName: true, email: true, phone: true } } } }
};

const courtDetailInclude = {
  ...courtInclude,
  reviews: {
    where: { displayStatus: "VISIBLE" as const },
    include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" as const }
  }
};

export const courtRepository = {
  async list(query: CourtListQuery, page: number, limit: number) {
    const where: Prisma.CourtWhereInput = {
      approvalStatus: "APPROVED",
      activeStatus: "ACTIVE",
      category: { status: "ACTIVE" }
    };

    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: "insensitive" } },
        { description: { contains: query.q, mode: "insensitive" } },
        { address: { contains: query.q, mode: "insensitive" } }
      ];
    }
    if (query.city) where.city = { contains: query.city, mode: "insensitive" };
    if (query.district) where.district = { contains: query.district, mode: "insensitive" };
    if (query.categoryId) where.categoryId = query.categoryId;

    const orderBy: Prisma.CourtOrderByWithRelationInput =
      query.sort === "newest" || !query.sort ? { createdAt: "desc" } : { name: "asc" };

    const [items, total] = await prisma.$transaction([
      prisma.court.findMany({
        where,
        include: courtInclude,
        orderBy,
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.court.count({ where })
    ]);

    return { items, total };
  },

  findPublicById(id: string) {
    return prisma.court.findFirst({
      where: { id, approvalStatus: "APPROVED", activeStatus: "ACTIVE" },
      include: courtDetailInclude
    });
  },

  findById(id: string) {
    return prisma.court.findUnique({ where: { id }, include: courtInclude });
  },

  nearby(courtId: string, city: string, district?: string) {
    return prisma.court.findMany({
      where: {
        id: { not: courtId },
        city,
        district: district ? { contains: district, mode: "insensitive" } : undefined,
        approvalStatus: "APPROVED",
        activeStatus: "ACTIVE",
        category: { status: "ACTIVE" }
      },
      include: courtInclude,
      orderBy: { createdAt: "desc" },
      take: 8
    });
  },

  availability(courtId: string, date: string) {
    return prisma.booking.findMany({
      where: {
        courtId,
        bookingDate: toDbDate(date),
        bookingStatus: { notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW] }
      },
      select: { id: true, bookingCode: true, startTime: true, endTime: true, bookingStatus: true },
      orderBy: { startTime: "asc" }
    });
  },

  findConflict(courtId: string, date: string, startTime: string, endTime: string) {
    return prisma.booking.findFirst({
      where: {
        courtId,
        bookingDate: toDbDate(date),
        bookingStatus: { notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW] },
        startTime: { lt: timeToDate(endTime) },
        endTime: { gt: timeToDate(startTime) }
      }
    });
  }
};
