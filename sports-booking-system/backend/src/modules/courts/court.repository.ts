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
  partner: { include: { user: { select: { fullName: true, email: true, phone: true } } } }
};

const courtDetailInclude = {
  ...courtInclude
};

const accentMap: Record<string, string> = {
  à: "a", á: "a", ạ: "a", ả: "a", ã: "a", â: "a", ầ: "a", ấ: "a", ậ: "a", ẩ: "a", ẫ: "a", ă: "a", ằ: "a", ắ: "a", ặ: "a", ẳ: "a", ẵ: "a",
  è: "e", é: "e", ẹ: "e", ẻ: "e", ẽ: "e", ê: "e", ề: "e", ế: "e", ệ: "e", ể: "e", ễ: "e",
  ì: "i", í: "i", ị: "i", ỉ: "i", ĩ: "i",
  ò: "o", ó: "o", ọ: "o", ỏ: "o", õ: "o", ô: "o", ồ: "o", ố: "o", ộ: "o", ổ: "o", ỗ: "o", ơ: "o", ờ: "o", ớ: "o", ợ: "o", ở: "o", ỡ: "o",
  ù: "u", ú: "u", ụ: "u", ủ: "u", ũ: "u", ư: "u", ừ: "u", ứ: "u", ự: "u", ử: "u", ữ: "u",
  ỳ: "y", ý: "y", ỵ: "y", ỷ: "y", ỹ: "y",
  đ: "d"
};

function removeVietnameseAccents(value: string) {
  return value
    .toLowerCase()
    .split("")
    .map((char) => accentMap[char] ?? char)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function searchVariants(value: string) {
  const trimmed = value.trim();
  const ascii = removeVietnameseAccents(trimmed);
  const withoutAdministrativePrefix = ascii
    .replace(/^(quan|q|huyen|h|thi xa|tx|thanh pho|tp|tp\.|tinh)\s+/i, "")
    .trim();

  return Array.from(new Set([trimmed, ascii, withoutAdministrativePrefix].filter(Boolean)));
}

function textSearchCondition(fields: Array<"name" | "description" | "address" | "city" | "district" | "ward">, value: string) {
  const variants = searchVariants(value);
  return {
    OR: variants.flatMap((variant) => fields.map((field) => ({ [field]: { contains: variant, mode: "insensitive" as const } })))
  };
}

let surfacesSeeded = false;

export async function ensureCourtSurfacesSeeded() {
  if (surfacesSeeded) return;
  surfacesSeeded = true;
  try {
    const courts = await prisma.court.findMany({
      select: {
        id: true,
        name: true,
        surfaces: { select: { id: true } }
      }
    });

    for (const c of courts) {
      if (c.surfaces.length < 3) {
        const needed = 3 - c.surfaces.length;
        const startIndex = c.surfaces.length + 1;
        for (let i = 0; i < needed; i++) {
          const num = startIndex + i;
          const code = `S0${num}`;
          const name = `${c.name} - Sân 0${num}`;
          await prisma.$executeRawUnsafe(
            `INSERT INTO court_surfaces (court_id, code, name, capacity, surface, size, status, sort_order, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7, NOW())
             ON CONFLICT DO NOTHING;`,
            c.id,
            code,
            name,
            "7 người / Đôi",
            "Cỏ nhân tạo / Thảm cao cấp",
            "Tiêu chuẩn",
            num
          );
        }
      }
    }
  } catch (err) {
    console.error("[CourtRepository] Seeding surfaces warning:", err);
  }
}

export const courtRepository = {
  async list(query: CourtListQuery, page: number, limit: number) {
    const categoryFilter: Prisma.CourtCategoryWhereInput = {};
    const andConditions: Prisma.CourtWhereInput[] = [];
    const where: Prisma.CourtWhereInput = {
      approvalStatus: "APPROVED",
      activeStatus: "ACTIVE"
    };

    const keyword = query.keyword ?? query.q;
    if (keyword) {
      andConditions.push(textSearchCondition(["name", "description", "address", "city", "district"], keyword));
    }
    const city = query.province ?? query.city;
    if (city) andConditions.push(textSearchCondition(["city"], city));
    if (query.district) andConditions.push(textSearchCondition(["district", "city", "ward", "address"], query.district));
    if (andConditions.length) where.AND = andConditions;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.sportType) {
      const sportType = query.sportType.trim();
      categoryFilter.OR = [
        { id: sportType },
        { slug: { equals: sportType.toLowerCase(), mode: "insensitive" } },
        { slug: { contains: sportType.toLowerCase().replace(/_/g, "-"), mode: "insensitive" } },
        { name: { contains: sportType.replace(/_/g, " "), mode: "insensitive" } }
      ];
    }
    if (Object.keys(categoryFilter).length > 0) {
      where.category = categoryFilter;
    }

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

    const latitude = Number(query.latitude);
    const longitude = Number(query.longitude);
    const radiusKmInput = query.radiusKm ? Number(query.radiusKm) : undefined;
    const hasRadiusFilter = Number.isFinite(radiusKmInput) && (radiusKmInput as number) > 0;
    const radiusKm = hasRadiusFilter ? (radiusKmInput as number) : undefined;
    const hasLocation = Number.isFinite(latitude) && Number.isFinite(longitude);

    if (hasLocation && hasRadiusFilter && radiusKm) {
      const latitudeDelta = radiusKm / 111;
      const longitudeDelta = radiusKm / (111 * Math.cos((latitude * Math.PI) / 180));
      where.latitude = { not: null, gte: latitude - latitudeDelta, lte: latitude + latitudeDelta };
      where.longitude = { not: null, gte: longitude - longitudeDelta, lte: longitude + longitudeDelta };
    }

    const orderBy: Prisma.CourtOrderByWithRelationInput =
      query.sortBy === "name" ? { name: query.sortOrder ?? "asc" } : query.sort === "newest" || !query.sort ? { createdAt: "desc" } : { name: "asc" };

    if (hasLocation || query.sortBy === "distance" || hasRadiusFilter) {
      const candidates = await prisma.court.findMany({
        where,
        include: courtInclude,
        orderBy
      });
      return { items: candidates, total: candidates.length };
    }

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

  async findPublicById(id: string) {
    await ensureCourtSurfacesSeeded();
    return prisma.court.findFirst({
      where: { id, approvalStatus: "APPROVED", activeStatus: "ACTIVE" },
      include: courtDetailInclude
    });
  },

  servicesByIds(ids: string[]) {
    return prisma.courtService.findMany({ where: { id: { in: ids } } });
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

  availability(courtId: string, date: string | string[]) {
    const dates = Array.isArray(date) ? date.map((d) => toDbDate(d)) : toDbDate(date);
    return prisma.booking.findMany({
      where: {
        courtId,
        bookingDate: Array.isArray(dates) ? { in: dates } : dates,
        bookingStatus: { notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW] }
      },
      select: { id: true, bookingCode: true, bookingDate: true, startTime: true, endTime: true, bookingStatus: true, payments: { select: { expiresAt: true, status: true } } },
      orderBy: { startTime: "asc" }
    });
  },

  bookingSlots(courtId: string, date: string | string[]) {
    const dates = Array.isArray(date) ? date.map((d) => toDbDate(d)) : toDbDate(date);
    return prisma.bookingSlot.findMany({
      where: {
        courtId,
        bookingDate: Array.isArray(dates) ? { in: dates } : dates,
        booking: {
          bookingStatus: { notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW] }
        }
      },
      select: {
        id: true,
        bookingId: true,
        bookingDate: true,
        startTime: true,
        endTime: true,
        slotPrice: true,
        booking: { select: { bookingStatus: true, payments: { select: { expiresAt: true, status: true } } } }
      },
      orderBy: { startTime: "asc" }
    });
  },

  availabilityBlocks(courtId: string, date: string | string[]) {
    const dates = Array.isArray(date) ? date.map((d) => toDbDate(d)) : toDbDate(date);
    return prisma.courtAvailabilityBlock.findMany({
      where: { courtId, blockDate: Array.isArray(dates) ? { in: dates } : dates, status: "ACTIVE" },
      select: { id: true, blockDate: true, startTime: true, endTime: true, reason: true, status: true },
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
      },
      include: { payments: { select: { expiresAt: true, status: true } } }
    });
  }
};