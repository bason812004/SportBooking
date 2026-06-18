import { NotFoundError } from "../../shared/errors/AppError.js";
import { paginationMeta } from "../../shared/utils/response.js";
import { parseLimit, parsePage, timeToMinutes } from "../../shared/utils/time.js";
import { courtRepository } from "./court.repository.js";
import type { CourtListQuery } from "./court.types.js";

function summarizeCourt<T extends { reviews: { rating: number }[]; prices: { price: unknown }[] }>(court: T) {
  const reviewCount = court.reviews.length;
  const averageRating = reviewCount ? court.reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount : 0;
  const minPrice = court.prices.length ? Math.min(...court.prices.map((price) => Number(price.price))) : 0;
  return { ...court, averageRating: Number(averageRating.toFixed(1)), reviewCount, minPrice };
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

export const courtService = {
  async list(query: CourtListQuery) {
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const { items, total } = await courtRepository.list(query, page, limit);
    return { items: items.map(summarizeCourt), meta: paginationMeta(page, limit, total) };
  },

  async detail(id: string) {
    const court = await courtRepository.findPublicById(id);
    if (!court) throw new NotFoundError("Khong tim thay san hoac san chua duoc duyet");
    const nearby = await courtRepository.nearby(court.id, court.city, court.district);
    return {
      ...summarizeCourt(court),
      ratingBreakdown: ratingBreakdown(court.reviews),
      nearbyCourts: nearby.map(summarizeCourt)
    };
  },

  async availability(id: string, date: string) {
    const court = await courtRepository.findPublicById(id);
    if (!court) throw new NotFoundError("Khong tim thay san");
    const [bookings, blocks] = await Promise.all([
      courtRepository.availability(id, date),
      courtRepository.availabilityBlocks(id, date)
    ]);
    const slots = [];
    const opening = timeToMinutes(timeText(court.openingTime));
    const closing = timeToMinutes(timeText(court.closingTime));

    for (let cursor = opening; cursor < closing; cursor += 60) {
      const slot = { startTime: minutesToTime(cursor), endTime: minutesToTime(Math.min(cursor + 60, closing)) };
      const isBooked = bookings.some((booking) => overlaps(slot, booking));
      const isBlocked = blocks.some((block) => overlaps(slot, block));
      slots.push({ ...slot, status: isBooked ? "BOOKED" : isBlocked ? "BLOCKED" : "AVAILABLE" });
    }

    return { courtId: id, date, slots, bookedSlots: bookings };
  }
};
