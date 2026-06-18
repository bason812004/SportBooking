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
  reviews: {
    where: { displayStatus: "VISIBLE" as const },
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      user: { select: { id: true, fullName: true, avatarUrl: true } }
    },
    orderBy: { createdAt: "desc" as const },
    take: 3
  },
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
    const categoryFilter: Prisma.CourtCategoryWhereInput = { status: "ACTIVE" };
    const where: Prisma.CourtWhereInput = {
      approvalStatus: "APPROVED",
      activeStatus: "ACTIVE",
      category: categoryFilter
    };

    const keyword = query.keyword ?? query.q;
    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: "insensitive" } },
        { description: { contains: keyword, mode: "insensitive" } },
        { address: { contains: keyword, mode: "insensitive" } }
      ];
    }
    const city = query.province ?? query.city;
    if (city) where.city = { contains: city, mode: "insensitive" };
    if (query.district) where.district = { contains: query.district, mode: "insensitive" };
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.sportType) categoryFilter.name = { contains: query.sportType, mode: "insensitive" };
    const minPrice = Number(query.minPrice);
    const maxPrice = Number(query.maxPrice);
    if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
      where.prices = {
        some: {
          price: {
            gte: Number.isFinite(minPrice) ? minPrice : undefined,
            lte: Number.isFinite(maxPrice) ? maxPrice : undefined
          }
        }
      };
    }

    const orderBy: Prisma.CourtOrderByWithRelationInput =
      query.sortBy === "name" ? { name: query.sortOrder ?? "asc" } : query.sort === "newest" || !query.sort ? { createdAt: "desc" } : { name: "asc" };

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

  availabilityBlocks(courtId: string, date: string) {
    return prisma.courtAvailabilityBlock.findMany({
      where: { courtId, blockDate: toDbDate(date) },
      select: { id: true, startTime: true, endTime: true, reason: true },
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
