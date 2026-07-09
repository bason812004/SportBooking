import { NotFoundError } from "../../shared/errors/AppError.js";
import { paginationMeta } from "../../shared/utils/response.js";
import { ceilToFullHour, dayTypeFor, floorToFullHour, parseLimit, parsePage, timeToMinutes } from "../../shared/utils/time.js";
import { calculateDistanceKm } from "../bookings/booking.calculations.js";
import { reviewRepository } from "../reviews/review.repository.js";
import { courtRepository } from "./court.repository.js";
import type { CourtListQuery } from "./court.types.js";

type CourtWithReviews<T> = T & { reviews: { rating: number }[] };

async function attachReviews<T extends { id: string }>(court: T): Promise<CourtWithReviews<T>> {
  return { ...court, reviews: await reviewRepository.byCourt(court.id) };
}

async function attachReviewsList<T extends { id: string }>(courts: T[]): Promise<Array<CourtWithReviews<T>>> {
  return Promise.all(courts.map((court) => attachReviews(court)));
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

function minutesToTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function overlaps(slot: { startTime: string; endTime: string }, item: { startTime: Date; endTime: Date }) {
  return timeToMinutes(slot.startTime) < timeToMinutes(timeText(item.endTime)) && timeToMinutes(slot.endTime) > timeToMinutes(timeText(item.startTime));
}

function slotPrice(
  slot: { startTime: string; endTime: string },
  date: string,
  prices: Array<{ dayType: string; startTime: Date; endTime: Date; price: unknown }>
) {
  const dayType = dayTypeFor(date);
  const matched = prices.find(
    (price) =>
      price.dayType === dayType &&
      timeToMinutes(slot.startTime) >= timeToMinutes(timeText(price.startTime)) &&
      timeToMinutes(slot.endTime) <= timeToMinutes(timeText(price.endTime))
  );
  if (matched) return Number(matched.price);
  return prices.length ? Math.min(...prices.map((price) => Number(price.price))) : 0;
}

function isExpiredPaymentHold(item: { payments?: Array<{ expiresAt: Date; status: string }> }) {
  if (!item.payments || item.payments.length === 0) return false;
  const activePayment = item.payments.find((payment) => payment.status === "PENDING" || payment.status === "UNPAID");
  if (!activePayment) return true;
  return activePayment.expiresAt.getTime() <= Date.now();
}

function bookingSlotStatus(item: { bookingStatus: string; payments?: Array<{ expiresAt: Date; status: string }> }) {
  if (item.bookingStatus === "PENDING" || item.bookingStatus === "PENDING_PAYMENT") {
    return isExpiredPaymentHold(item) ? "AVAILABLE" : "PENDING_PAYMENT";
  }
  if (item.bookingStatus === "CONFIRMED" || item.bookingStatus === "COMPLETED") return "BOOKED";
  return "AVAILABLE";
}

export const courtService = {
  async list(query: CourtListQuery) {
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const latitude = Number(query.latitude);
    const longitude = Number(query.longitude);
    const radiusKm = Number(query.radiusKm || 25);
    const userLocation = Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : undefined;
    const { items, total } = await courtRepository.list(query, page, limit);
    const itemsWithReviews = await attachReviewsList(items);
    let summarized = itemsWithReviews.map((item) => summarizeCourt(item, userLocation));
    if (userLocation) summarized = summarized.filter((item) => item.distanceKm === null || item.distanceKm <= radiusKm);
    if (query.sortBy === "distance" && userLocation) {
      summarized.sort((left, right) => (left.distanceKm ?? Number.MAX_SAFE_INTEGER) - (right.distanceKm ?? Number.MAX_SAFE_INTEGER));
    }
    const start = (page - 1) * limit;
    const paged = userLocation || query.sortBy === "distance" ? summarized.slice(start, start + limit) : summarized;
    return { items: paged, meta: paginationMeta(page, limit, userLocation || query.sortBy === "distance" ? summarized.length : total) };
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
    const slots = [];
    const opening = ceilToFullHour(timeToMinutes(timeText(court.openingTime)));
    const closing = floorToFullHour(timeToMinutes(timeText(court.closingTime)));

    for (let cursor = opening; cursor < closing; cursor += 60) {
      const slot = { startTime: minutesToTime(cursor), endTime: minutesToTime(cursor + 60) };
      const matchedBookingSlots = bookingSlots.filter((bookingSlot) => overlaps(slot, bookingSlot));
      const matchedBookings = bookings.filter((booking) => overlaps(slot, booking));
      const isBlocked = blocks.some((block) => overlaps(slot, block));
      const price = slotPrice(slot, date, court.prices);

      let status = "AVAILABLE";
      if (isBlocked) {
        status = "BLOCKED";
      } else {
        const statuses = [
          ...matchedBookingSlots.map(bs => bookingSlotStatus({ bookingStatus: bs.booking.bookingStatus, payments: bs.booking.payments })),
          ...matchedBookings.map(b => bookingSlotStatus(b))
        ];
        if (statuses.includes("BOOKED")) {
          status = "BOOKED";
        } else if (statuses.includes("PENDING_PAYMENT")) {
          status = "PENDING_PAYMENT";
        }
      }

      const activeSlot = matchedBookingSlots.find(bs => bookingSlotStatus({ bookingStatus: bs.booking.bookingStatus, payments: bs.booking.payments }) !== "AVAILABLE") || matchedBookingSlots[0];
      const activeBooking = matchedBookings.find(b => bookingSlotStatus(b) !== "AVAILABLE") || matchedBookings[0];
      const bookingId = activeSlot?.bookingId ?? activeBooking?.id ?? null;

      slots.push({ ...slot, status, price, bookingId });
    }

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
