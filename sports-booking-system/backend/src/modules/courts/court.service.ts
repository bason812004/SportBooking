import { NotFoundError } from "../../shared/errors/AppError.js";
import { paginationMeta } from "../../shared/utils/response.js";
import { parseLimit, parsePage } from "../../shared/utils/time.js";
import { buildSlotGrid } from "../../shared/utils/slotGrid.js";
import { calculateDistanceKm } from "../bookings/booking.calculations.js";
import { reviewRepository } from "../reviews/review.repository.js";
import { courtRepository } from "./court.repository.js";
import type { CourtListQuery } from "./court.types.js";

type CourtWithReviews<T> = T & { reviews: { rating: number }[] };

async function attachReviews<T extends { id: string }>(court: T): Promise<CourtWithReviews<T>> {
  return { ...court, reviews: await reviewRepository.byCourt(court.id) };
}

async function attachReviewsList<T extends { id: string }>(courts: T[]): Promise<Array<CourtWithReviews<T>>> {
  if (courts.length === 0) return [];
  const courtIds = courts.map((c) => c.id);
  const reviewsMap = await reviewRepository.byCourts(courtIds);
  return courts.map((court) => ({
    ...court,
    reviews: reviewsMap.get(court.id) ?? []
  }));
}

function summarizeCourt<T extends { latitude?: unknown; longitude?: unknown; reviews?: { rating: number }[]; prices: { price: unknown }[] }>(
  court: T,
  userLocation?: { latitude: number; longitude: number }
) {
  const reviews = court.reviews ?? [];
  const reviewCount = reviews.length;
  const averageRating = reviewCount ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount : 0;
  const minPrice = court.prices.length ? Math.min(...court.prices.map((price) => Number(price.price))) : 0;
  const hasCourtLocation = court.latitude !== null && court.latitude !== undefined && court.longitude !== null && court.longitude !== undefined;
  const distanceKm =
    userLocation && hasCourtLocation
      ? calculateDistanceKm(userLocation, { latitude: Number(court.latitude), longitude: Number(court.longitude) })
      : null;
  return { ...court, averageRating: Number(averageRating.toFixed(1)), reviewCount, minPrice, distanceKm };
}

function ratingBreakdown(reviews: { rating: number }[]) {
  const total = reviews.length;
  return [5, 4, 3, 2, 1].map((rating) => {
    const count = reviews.filter((review) => review.rating === rating).length;
    return { rating, count, percent: total ? Math.round((count / total) * 100) : 0 };
  });
}

function timeText(value: Date) {
  return value.toISOString().slice(11, 16);
}

export const courtService = {
  async list(query: CourtListQuery) {
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const latitude = Number(query.latitude);
    const longitude = Number(query.longitude);
    const radiusKmInput = query.radiusKm ? Number(query.radiusKm) : undefined;
    const hasRadiusFilter = Number.isFinite(radiusKmInput) && (radiusKmInput as number) > 0;
    const radiusKm = hasRadiusFilter ? (radiusKmInput as number) : undefined;

    const userLocation = Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : undefined;
    const { items, total } = await courtRepository.list(query, page, limit);

    // Lightweight in-memory distance calculation and summary
    let summarized = items.map((item) => summarizeCourt(item, userLocation));

    // Only filter by distance radius IF explicitly passed by user
    if (userLocation && hasRadiusFilter && radiusKm) {
      summarized = summarized.filter((item) => item.distanceKm === null || item.distanceKm <= radiusKm);
    }

    if (query.sortBy === "distance" && userLocation) {
      summarized.sort((left, right) => (left.distanceKm ?? Number.MAX_SAFE_INTEGER) - (right.distanceKm ?? Number.MAX_SAFE_INTEGER));
    }

    const needsCustomPagination = Boolean(userLocation || query.sortBy === "distance" || hasRadiusFilter);
    const effectiveTotal = needsCustomPagination ? summarized.length : total;
    const start = (page - 1) * limit;
    const pagedCandidates = needsCustomPagination ? summarized.slice(start, start + limit) : summarized;

    // Attach reviews ONLY to the paged items (dramatically faster!)
    const itemsWithReviews = await attachReviewsList(pagedCandidates);
    const paged = itemsWithReviews.map((item) => summarizeCourt(item, userLocation));

    return { items: paged, meta: paginationMeta(page, limit, effectiveTotal) };
  },

  async detail(id: string) {
    const court = await courtRepository.findPublicById(id);
    if (!court) throw new NotFoundError("Khong tim thay san hoac san chua duoc duyet");
    const [courtWithReviews, nearby] = await Promise.all([
      attachReviews(court),
      courtRepository.nearby(court.id, court.city, court.district).then(attachReviewsList)
    ]);
    return {
      ...summarizeCourt(courtWithReviews),
      ratingBreakdown: ratingBreakdown(courtWithReviews.reviews),
      nearbyCourts: nearby.map((item) => summarizeCourt(item))
    };
  },

  async availability(id: string, date: string) {
    const court = await courtRepository.findPublicById(id);
    if (!court) throw new NotFoundError("Khong tim thay san");
    const [bookings, bookingSlots, blocks] = await Promise.all([
      courtRepository.availability(id, date),
      courtRepository.bookingSlots(id, date),
      courtRepository.availabilityBlocks(id, date)
    ]);
    const slots = buildSlotGrid({
      date,
      openingTime: court.openingTime,
      closingTime: court.closingTime,
      bookings,
      bookingSlots,
      blocks,
      prices: court.prices
    });

    return {
      courtId: id,
      date,
      openingTime: timeText(court.openingTime),
      closingTime: timeText(court.closingTime),
      slotDurationMinutes: 60,
      slots,
      bookedSlots: bookings
    };
  }
};
