import { BookingStatus } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { ForbiddenError, NotFoundError, ValidationError, ConflictError } from "../../shared/errors/AppError.js";
import { cloudinaryService } from "../../shared/services/cloudinary.service.js";
import { paginationMeta } from "../../shared/utils/response.js";
import { maskAccountNumber } from "../../shared/utils/bankAccount.js";
import { bookingStartsAt, parseLimit, parsePage, timeToDate, timeToMinutes, toDbDate, vietnamNow } from "../../shared/utils/time.js";
import { buildSlotGrid } from "../../shared/utils/slotGrid.js";
import { uniqueSlug } from "../../shared/utils/slug.js";
import { commissionService } from "../commission/commission.service.js";
import { realtimeEvents } from "../realtime/realtime.events.js";
import { realtimeService } from "../realtime/realtime.service.js";
import { settlementService } from "../settlements/settlement.service.js";
import { releaseBookingStock } from "../inventory/inventory.stock.js";
import { voucherRepository } from "../vouchers/voucher.repository.js";
import { userRepository } from "../users/user.repository.js";
import { partnerRepository } from "./partner.repository.js";
import { needsReview } from "./partner.profileReview.js";
import { hashPassword } from "../auth/auth.security.js";
import { authRepository } from "../auth/auth.repository.js";
import { authService } from "../auth/auth.service.js";
import { emailService } from "../email/email.service.js";
import { forgetAccountStatus } from "../auth/accountStatus.js";
import { cashierRepository } from "../cashier/cashier.repository.js";
import { courtImageService } from "../court-images/courtImage.service.js";
import type { CourtRegistrationInput, CourtSurfaceInput } from "./partner.validation.js";
import { sportCourtName } from "../../shared/utils/courtSurface.js";
import { toTimeChargePolicy, type TimeChargePolicy } from "../recipient/recipient.calculations.js";
import { bookingRepository } from "../bookings/booking.repository.js";
import { COURT_BOOKING_TRANSITIONS, counterCollectedAmount, courtCancellationPayment, refundRequiredAdminEvent } from "../bookings/booking.calculations.js";
import { assertNothingOwed } from "../checkout/checkout.balance.js";
import { sortGroupKeysByBillTotal } from "../checkout/checkout.calculations.js";
import { enqueueAdminEvent } from "../notifications/notificationOutbox.repository.js";
import { notificationService } from "../notifications/notification.service.js";
import { blogService } from "../blogs/blog.service.js";
import { replyRemovals, reviewRepository } from "../reviews/review.repository.js";
import { bookingOverdueService } from "../booking-overdue/bookingOverdue.service.js";
import { canCorrectAutoNoShow } from "../booking-overdue/bookingOverdue.calculations.js";
import { summarizeRatings } from "../reviews/review.calculations.js";
import { holidayRepository } from "../holidays/holiday.repository.js";
import { describeBooking, notifyBookingDecision, notifyCourtChange } from "../bookings/bookingNotices.js";
import { conflictingBand, minutesClock, priceBands, type PriceBand } from "../../shared/utils/courtPricing.js";

/** What identifies a court to customers: changing it sends the court back to the admin. */
const REVIEWED_COURT_FIELDS = ["name", "address", "ward", "city", "categoryId"] as const;
const sameText = (a: unknown, b: unknown) => String(a ?? "").trim().replace(/\s+/g, " ") === String(b ?? "").trim().replace(/\s+/g, " ");
const dayTypeNames: Record<string, string> = { WEEKDAY: "Ngày thường", WEEKEND: "Cuối tuần", HOLIDAY: "Ngày lễ" };

type PriceRowInput = { dayType: string; startTime: string; endTime: string };

/** A price row must end after it starts and must not partly overlap another row of the same day type; null when it fits. */
function priceRowProblem(input: PriceRowInput, others: PriceBand[]) {
  const start = timeToMinutes(input.startTime);
  const end = timeToMinutes(input.endTime) || 24 * 60;
  if (start >= end) return "Giờ kết thúc phải sau giờ bắt đầu";
  const conflict = conflictingBand({ dayType: input.dayType, start, end }, others);
  if (!conflict) return null;
  return (
    `Khung ${input.startTime}-${input.endTime} trùng hoặc chồng một phần lên khung ${minutesClock(conflict.start)}-${minutesClock(conflict.end)} (${dayTypeNames[conflict.dayType] ?? conflict.dayType}). ` +
    "Một khung nằm trọn trong khung khác thì được: giờ đó lấy giá của khung hẹp hơn."
  );
}

async function assertPriceRow(courtId: string, input: PriceRowInput, excludeId?: string) {
  const others = (await partnerRepository.courtPrices(courtId)).filter((row) => row.id !== excludeId);
  const problem = priceRowProblem(input, priceBands(others));
  if (problem) throw new ValidationError(problem);
}

/** The expected prices of one sport at registration, checked against each other by the price page's rule. */
function assertRegistrationPrices(sportName: string, rows: Array<PriceRowInput & { price: number }>) {
  const accepted: PriceBand[] = [];
  for (const row of rows) {
    const problem = priceRowProblem(row, accepted);
    if (problem) throw new ValidationError(`Giá dự kiến môn ${sportName}: ${problem}`);
    accepted.push(...priceBands([row]));
  }
}

const listBookings = (rows: Array<{ bookingCode: string; bookingDate: Date; startTime: string; endTime: string }>) =>
  rows.slice(0, 5).map(describeBooking).join(", ") + (rows.length > 5 ? ` và ${rows.length - 5} đơn khác` : "");

const partnerSave = { submit: false };

const BANK_FIELDS = ["bankName", "bankAccountNumber", "bankAccountHolder"] as const;

/** How a bank account holder is written for transfers: upper case, single spaces. */
function holderName(value: string | null | undefined) {
  const name = value?.trim().replace(/\s+/g, " ");
  return name ? name.toLocaleUpperCase("vi-VN") : null;
}

/** In the app and by email: if the partner did not make the change, they learn of it before money moves. */
async function noticeBankChange(userId: string, profile: { businessName: string; user: { email: string; fullName: string } }, next: { bankName: string | null; bankAccountNumber: string | null }) {
  const masked = maskAccountNumber(next.bankAccountNumber);
  const account = next.bankName || masked ? `${next.bankName ?? ""} ${masked ?? ""}`.trim() : "đã xoá";
  try {
    await notificationService.create({
      userId,
      title: "Tài khoản ngân hàng nhận tiền đã thay đổi",
      content: `Tài khoản nhận tiền rút của ${profile.businessName} vừa được đổi (${account}). Nếu không phải bạn, hãy đổi mật khẩu ngay và liên hệ quản trị viên.`,
      type: "BANK_ACCOUNT_CHANGED",
      metadata: { bankName: next.bankName, account: masked }
    });
  } catch (error) {
    console.error("[PartnerProfile] Bank change notification failed:", error);
  }
  try {
    await emailService.sendBankAccountChanged({
      to: profile.user.email,
      fullName: profile.user.fullName,
      businessName: profile.businessName,
      bankName: next.bankName,
      maskedAccount: masked,
      changedAt: new Date()
    });
  } catch (error) {
    // Email may not be configured (no SMTP); the in-app notice still went out.
    console.error("[PartnerProfile] Bank change email failed:", error);
  }
}

async function getProfile(userId: string) {
  const profile = await partnerRepository.profileByUser(userId);
  if (!profile) throw new ForbiddenError("Tai khoan doi tac chua co ho so");
  return profile;
}

function dbTime(value: Date) {
  return value.toISOString().slice(11, 16);
}

const MAX_BULK_BLOCK_DAYS = 92;

/** The profile plus the latest admin decision, so a rejected partner can see what to fix. */
async function profileWithReview(userId: string) {
  const profile = await getProfile(userId);
  return { ...profile, latestReview: await partnerRepository.latestModeration(profile.id) };
}

/** "Sân đang phục vụ": the booking has started and is still open (not completed, cancelled or no-show). */
const SERVING_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.DEPOSIT_PAID,
  BookingStatus.IN_PROGRESS,
  BookingStatus.CHECKOUT_PENDING
];

export const partnerService = {
  async dashboard(userId: string) {
    const profile = await getProfile(userId);
    const [courts, bookingsToday, revenue, pendingBookings, trendRows, courtStatuses, recentBookings, previousRevenue] =
      await partnerRepository.dashboard(profile.id);
    const trend = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - (6 - index));
      const key = date.toISOString().slice(0, 10);
      return {
        date: key,
        bookings: trendRows.filter((row) => row.bookingDate.toISOString().slice(0, 10) === key).length
      };
    });
    const currentRevenue = Number(revenue._sum.netAmount ?? 0);
    const previous = Number(previousRevenue._sum.netAmount ?? 0);
    return {
      courts,
      bookingsToday,
      revenue: currentRevenue,
      pendingBookings,
      revenueGrowth: previous > 0 ? ((currentRevenue - previous) / previous) * 100 : null,
      trend,
      courtStatuses,
      recentBookings
    };
  },

  async profile(userId: string) {
    return profileWithReview(userId);
  },

  async updateProfile(userId: string, input: any) {
    const profile = await getProfile(userId);
    const normalized = (value: string | null | undefined) => value?.trim() || null;
    const next = {
      businessName: input.businessName,
      address: input.address,
      verificationDocumentUrl: input.verificationDocumentUrl || null,
      bankName: normalized(input.bankName),
      bankAccountNumber: normalized(input.bankAccountNumber),
      bankAccountHolder: holderName(input.bankAccountHolder),
      taxCode: input.taxCode || null
    };
    const bankChanged = BANK_FIELDS.some((field) => next[field] !== normalized(profile[field]));
    // Checked before anything is saved, so a wrong password leaves the whole profile as it was.
    if (bankChanged) await authService.verifyCurrentPassword(userId, input.currentPassword);
    await userRepository.updateMe(userId, {
      fullName: input.fullName,
      // Empty clears them (the schema turns "" into null).
      phone: input.phone ?? null,
      avatarUrl: input.avatarUrl ?? null
    });
    await partnerRepository.updateProfile(profile.id, {
      ...next,
      // Withdrawals wait 24 hours after the account withdrawals go to was set or changed.
      ...(bankChanged ? { bankAccountChangedAt: new Date() } : {}),
      ...(needsReview(profile, next) ? { approvalStatus: "PENDING" as const } : {})
    });
    if (bankChanged) await noticeBankChange(userId, profile, next);
    return profileWithReview(userId);
  },

  /** Puts a verification document in cloud storage; the profile keeps its link once the partner saves it. */
  async uploadProfileDocument(userId: string, file: Express.Multer.File | undefined) {
    const profile = await getProfile(userId);
    if (!file) throw new ValidationError("Chọn một file ảnh hoặc PDF");
    const uploaded = await cloudinaryService.uploadPartnerDocument(file, profile.id);
    return { url: uploaded.url, fileName: file.originalname, size: uploaded.bytes };
  },

  async courts(userId: string) {
    const profile = await getProfile(userId);
    const courts = await partnerRepository.listCourts(profile.id);
    return courts.map(({ _count, ...court }) => ({ ...court, surfaceCount: _count.surfaces }));
  },

  async courtDetail(userId: string, courtId: string) {
    const profile = await getProfile(userId);
    const court = await partnerRepository.courtByPartner(courtId, profile.id);
    if (!court) throw new NotFoundError("Khong tim thay san cua ban");
    return court;
  },

  async createCourt(userId: string, input: any) {
    const profile = await getProfile(userId);
    if (timeToMinutes(input.openingTime) >= timeToMinutes(input.closingTime)) throw new ValidationError("Gio mo cua khong hop le");
    return partnerRepository.createCourt({
      partnerId: profile.id,
      categoryId: input.categoryId,
      name: input.name,
      slug: uniqueSlug(input.name),
      description: input.description,
      address: input.address,
      city: input.city,
      // No district level any more: address + ward + city (see partner.validation courtWriteSchema).
      district: null,
      ward: input.ward,
      latitude: input.latitude,
      longitude: input.longitude,
      openingTime: timeToDate(input.openingTime),
      closingTime: timeToDate(input.closingTime),
      approvalStatus: "PENDING",
      activeStatus: "ACTIVE"
    }, input.depositPercent ?? null);
  },

  async registerCourts(userId: string, input: CourtRegistrationInput) {
    const profile = await getProfile(userId);
    if (timeToMinutes(input.openingTime) >= timeToMinutes(input.closingTime)) throw new ValidationError("Gio mo cua khong hop le");
    const categoryIds = input.sports.map((sport) => sport.categoryId);
    const categories = new Map((await partnerRepository.activeCategoriesByIds(categoryIds)).map((category) => [category.id, category]));
    if (categoryIds.some((id) => !categories.has(id))) throw new ValidationError("Môn thể thao không tồn tại hoặc đã ngừng hoạt động");
    for (const sport of input.sports) assertRegistrationPrices(categories.get(sport.categoryId)!.name, sport.prices);

    const multiSport = input.sports.length > 1;
    const slugs = new Set<string>();
    const entries = input.sports.map((sport) => {
      const name = multiSport ? sportCourtName(input.name, categories.get(sport.categoryId)!.name) : input.name;
      let slug = uniqueSlug(name);
      for (let n = 2; slugs.has(slug); n += 1) slug = `${uniqueSlug(name)}-${n}`;
      slugs.add(slug);
      return {
        data: {
          partnerId: profile.id,
          categoryId: sport.categoryId,
          name,
          slug,
          description: input.description,
          address: input.address,
          city: input.city,
          district: null,
          ward: input.ward,
          latitude: input.latitude,
          longitude: input.longitude,
          openingTime: timeToDate(input.openingTime),
          closingTime: timeToDate(input.closingTime),
          approvalStatus: "PENDING" as const,
          activeStatus: "ACTIVE" as const
        },
        surfaces: sport.surfaces.map((surface) => ({ name: surface.name, surface: surface.surface, size: surface.size })),
        prices: sport.prices.map((row) => ({
          dayType: row.dayType,
          startTime: timeToDate(row.startTime),
          endTime: timeToDate(row.endTime),
          price: row.price
        }))
      };
    });
    return { courts: await partnerRepository.createCourts(entries, input.depositPercent ?? null) };
  },

  /**
   * Only a change to what identifies the court (name, address, sport) sends it back to the admin; the description,
   * hours and deposit apply at once. The address keeps its link (slug). Customers whose upcoming bookings fall
   * outside new hours are told; the form shows the partner who they are before saving (affectedBookings).
   */
  async updateCourt(userId: string, courtId: string, input: any) {
    const profile = await getProfile(userId);
    const existing = await partnerRepository.courtByPartner(courtId, profile.id);
    if (!existing) throw new NotFoundError("Khong tim thay san cua ban");
    const { depositPercent, requireDeposit: _requireDeposit, ...courtInput } = input;
    const openingTime = courtInput.openingTime ?? dbTime(existing.openingTime);
    const closingTime = courtInput.closingTime ?? dbTime(existing.closingTime);
    if (timeToMinutes(openingTime) >= timeToMinutes(closingTime)) throw new ValidationError("Giờ đóng cửa phải sau giờ mở cửa");

    const reviewNeeded = REVIEWED_COURT_FIELDS.some(
      (field) => courtInput[field] !== undefined && !sameText(courtInput[field], (existing as Record<string, unknown>)[field])
    );
    const hoursChanged = openingTime !== dbTime(existing.openingTime) || closingTime !== dbTime(existing.closingTime);
    const outsideHours = hoursChanged
      ? await partnerRepository.upcomingBookings(courtId, { outside: { open: openingTime, close: closingTime } })
      : [];
    // The form re-enters the address as address + ward + city, so an old district would no longer match it.
    const addressChanged = ["address", "ward", "city"].some((field) => courtInput[field] !== undefined && !sameText(courtInput[field], (existing as Record<string, unknown>)[field]));

    const updated = await partnerRepository.updateCourt(courtId, {
      ...courtInput,
      ...(addressChanged ? { district: null } : {}),
      openingTime: timeToDate(openingTime),
      closingTime: timeToDate(closingTime),
      ...(reviewNeeded ? { approvalStatus: "PENDING" as const } : {})
    }, depositPercent ?? null);

    if (outsideHours.length) {
      await notifyCourtChange(outsideHours, { id: courtId, name: updated?.name ?? existing.name }, `đổi giờ hoạt động thành ${openingTime}-${closingTime}, đơn của bạn nằm ngoài giờ mới`);
    }
    return { ...updated, reviewRequired: reviewNeeded, notifiedBookings: outsideHours.length };
  },

  /**
   * Upcoming bookings a change would touch, for the partner to see before confirming it: every one at the court (or
   * one sub-court) for a pause, or those outside new opening hours.
   */
  async affectedBookings(userId: string, courtId: string, query: { surfaceId?: string; openingTime?: string; closingTime?: string }) {
    const profile = await getProfile(userId);
    if (!(await partnerRepository.courtByPartner(courtId, profile.id))) throw new NotFoundError("Khong tim thay san cua ban");
    const outside = query.openingTime && query.closingTime ? { open: query.openingTime, close: query.closingTime } : undefined;
    return partnerRepository.upcomingBookings(courtId, { surfaceId: query.surfaceId, outside });
  },

  async timeChargePolicy(userId: string, courtId: string) {
    const profile = await getProfile(userId);
    const policy = await partnerRepository.courtTimeChargePolicy(courtId, profile.id);
    if (!policy) throw new NotFoundError("Khong tim thay san cua ban");
    return toTimeChargePolicy(policy);
  },

  /** Operational setting for the counter: saved directly, without sending the court back to approval. */
  async updateTimeChargePolicy(userId: string, courtId: string, input: TimeChargePolicy) {
    const profile = await getProfile(userId);
    if (!(await partnerRepository.courtTimeChargePolicy(courtId, profile.id))) throw new NotFoundError("Khong tim thay san cua ban");
    return toTimeChargePolicy(await partnerRepository.updateCourtTimeChargePolicy(courtId, input));
  },

  async deactivateCourt(userId: string, courtId: string) {
    return this.updateCourtStatus(userId, courtId, "INACTIVE");
  },

  /**
   * The partner pauses or resumes a court. A court an admin locked stays locked until an admin opens it. Pausing
   * tells the customers of its upcoming bookings (the page lists them before the partner confirms).
   */
  async updateCourtStatus(userId: string, courtId: string, activeStatus: "ACTIVE" | "INACTIVE") {
    const profile = await getProfile(userId);
    const existing = await partnerRepository.courtByPartner(courtId, profile.id);
    if (!existing) throw new NotFoundError("Khong tim thay san cua ban");
    if (existing.adminLockedAt) {
      throw new ForbiddenError(
        `Sân đang bị quản trị viên khoá${existing.adminLockReason ? `: ${existing.adminLockReason}` : ""}. Liên hệ quản trị viên để mở lại.`
      );
    }
    if (existing.activeStatus === activeStatus) return existing;
    const upcoming = activeStatus === "INACTIVE" ? await partnerRepository.upcomingBookings(courtId) : [];
    const updated = await partnerRepository.updateCourt(courtId, { activeStatus });
    if (upcoming.length) await notifyCourtChange(upcoming, { id: courtId, name: existing.name }, "tạm ngưng nhận đặt sân mới");
    return updated;
  },

  async addImage(userId: string, courtId: string, input: { imageUrl?: string; sortOrder?: number; replaceImageId?: string }, file?: Express.Multer.File) {
    return courtImageService.submit(userId, courtId, input, file);
  },

  async deleteImage(userId: string, imageId: string) {
    const profile = await getProfile(userId);
    const image = await partnerRepository.imageByPartner(imageId, profile.id);
    if (!image) throw new NotFoundError("Khong tim thay anh san");
    const deleted = await partnerRepository.deleteImage(image.id);
    await cloudinaryService.deleteImage(deleted.publicId);
    // Removing an existing image does not require re-approving the court.
    return { id: image.id };
  },

  async reorderImages(userId: string, courtId: string, imageIds: string[]) {
    const profile = await getProfile(userId);
    const court = await partnerRepository.courtByPartner(courtId, profile.id);
    if (!court) throw new NotFoundError("Khong tim thay san cua ban");
    const ownedIds = new Set(court.images.map((image) => image.id));
    if (imageIds.some((id) => !ownedIds.has(id)) || imageIds.length !== court.images.length) {
      throw new ValidationError("Danh sach anh khong hop le");
    }
    await partnerRepository.reorderImages(courtId, imageIds);
    return partnerRepository.courtByPartner(courtId, profile.id);
  },

  async addPrice(userId: string, courtId: string, input: any) {
    const profile = await getProfile(userId);
    const court = await partnerRepository.courtByPartner(courtId, profile.id);
    if (!court) throw new NotFoundError("Khong tim thay san cua ban");
    await assertPriceRow(courtId, input);
    return partnerRepository.addPrice({
      courtId,
      dayType: input.dayType,
      startTime: timeToDate(input.startTime),
      endTime: timeToDate(input.endTime),
      price: input.price,
      note: input.note
    });
  },

  async updatePrice(userId: string, priceId: string, input: any) {
    const profile = await getProfile(userId);
    const current = await partnerRepository.priceByPartner(priceId, profile.id);
    if (!current) throw new NotFoundError("Khong tim thay bang gia");
    await assertPriceRow(current.courtId, {
      dayType: input.dayType ?? current.dayType,
      startTime: input.startTime ?? dbTime(current.startTime),
      endTime: input.endTime ?? dbTime(current.endTime)
    }, priceId);
    return partnerRepository.updatePrice(priceId, {
      dayType: input.dayType,
      startTime: input.startTime ? timeToDate(input.startTime) : undefined,
      endTime: input.endTime ? timeToDate(input.endTime) : undefined,
      price: input.price,
      note: input.note
    });
  },

  async deletePrice(userId: string, priceId: string) {
    const profile = await getProfile(userId);
    if (!(await partnerRepository.priceByPartner(priceId, profile.id))) throw new NotFoundError("Khong tim thay bang gia");
    return partnerRepository.deletePrice(priceId);
  },

  async addService(userId: string, courtId: string, input: any) {
    const profile = await getProfile(userId);
    const court = await partnerRepository.courtByPartner(courtId, profile.id);
    if (!court) throw new NotFoundError("Khong tim thay san cua ban");
    return partnerRepository.addService({ courtId, ...input, status: input.status ?? "ACTIVE" });
  },

  async updateService(userId: string, serviceId: string, input: any) {
    const profile = await getProfile(userId);
    if (!(await partnerRepository.serviceByPartner(serviceId, profile.id))) throw new NotFoundError("Khong tim thay dich vu");
    return partnerRepository.updateService(serviceId, input);
  },

  async deleteService(userId: string, serviceId: string) {
    const profile = await getProfile(userId);
    if (!(await partnerRepository.serviceByPartner(serviceId, profile.id))) throw new NotFoundError("Khong tim thay dich vu");
    return partnerRepository.deleteService(serviceId);
  },

  async bookings(
    userId: string,
    query: {
      page?: string;
      limit?: string;
      courtId?: string;
      status?: BookingStatus;
      serving?: string;
      search?: string;
      fromDate?: string;
      toDate?: string;
      sortBy?: string;
      sortOrder?: string;
    }
  ) {
    const profile = await getProfile(userId);
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    if (query.fromDate && query.toDate && query.fromDate > query.toDate) {
      throw new ValidationError("Khoang ngay khong hop le");
    }

    const now = query.serving === "true" ? vietnamNow() : null;
    const where = partnerRepository.bookingWhere(profile.id, {
      courtId: query.courtId,
      status: query.status,
      statuses: now ? SERVING_BOOKING_STATUSES : undefined,
      startedBy: now ? { date: toDbDate(now.date), time: timeToDate(now.time) } : undefined,
      search: query.search,
      fromDate: query.fromDate ? toDbDate(query.fromDate) : undefined,
      toDate: query.toDate ? toDbDate(query.toDate) : undefined
    });

    // Bookings created together as one order (multi-slot/multi-surface walk-in,
    // or a customer's multi-day booking) share a bookingOrderId and should
    // page/display as a single group, not as N separate rows. A group can't be
    // split across pages, so paginate over deduped group keys first.
    const matchingRows = await partnerRepository.bookingMatchingRows(where, query.sortBy, query.sortOrder);

    const groupKeys: string[] = [];
    const isOrderKey = new Map<string, boolean>();
    const seen = new Set<string>();
    for (const row of matchingRows) {
      const key = row.bookingOrderId ?? row.id;
      if (seen.has(key)) continue;
      seen.add(key);
      groupKeys.push(key);
      isOrderKey.set(key, Boolean(row.bookingOrderId));
    }

    // The list shows each group's bill total (court + services - voucher), not bookings.total_price,
    // so "totalPrice" sorts the groups by that. Ties keep the database order above.
    let orderedKeys = groupKeys;
    if (query.sortBy === "totalPrice" && groupKeys.length) {
      const billRows = await partnerRepository.bookingBillRows(
        profile.id,
        groupKeys.filter((key) => isOrderKey.get(key)),
        groupKeys.filter((key) => !isOrderKey.get(key))
      );
      orderedKeys = sortGroupKeysByBillTotal(groupKeys, billRows, query.sortOrder);
    }

    const total = groupKeys.length;
    const pageKeys = orderedKeys.slice((page - 1) * limit, (page - 1) * limit + limit);
    const orderIds = pageKeys.filter((key) => isOrderKey.get(key));
    const standaloneIds = pageKeys.filter((key) => !isOrderKey.get(key));

    const [orderBookings, standaloneBookings] = await Promise.all([
      partnerRepository.bookingsByOrderIds(profile.id, orderIds),
      partnerRepository.bookingsByIds(profile.id, standaloneIds)
    ]);

    const bookingsByOrderId = new Map<string, typeof orderBookings>();
    for (const booking of orderBookings) {
      const key = booking.bookingOrderId!;
      const list = bookingsByOrderId.get(key);
      if (list) list.push(booking);
      else bookingsByOrderId.set(key, [booking]);
    }
    const standaloneById = new Map(standaloneBookings.map((booking) => [booking.id, booking]));

    const items = pageKeys.map((key) =>
      isOrderKey.get(key)
        ? { orderId: key, bookings: bookingsByOrderId.get(key) ?? [] }
        : { orderId: null, bookings: [standaloneById.get(key)!] }
    );

    return { items, meta: paginationMeta(page, limit, total) };
  },

  /** Bookings of the partner's courts that are over but still open, with when the system finishes each. */
  async overdueBookings(userId: string) {
    const profile = await getProfile(userId);
    return bookingOverdueService.openOverdue({ partnerId: profile.id });
  },

  /** Rejecting or cancelling needs the reason the customer is told. */
  async updateBookingStatus(userId: string, bookingId: string, status: BookingStatus, reason?: string) {
    const profile = await getProfile(userId);
    const booking = await partnerRepository.bookingByPartner(bookingId, profile.id);
    if (!booking) throw new NotFoundError("Khong tim thay don cua san ban");

    // A no-show the system recorded (nobody checked the customer in) can be corrected if they did play.
    const correctingAutoNoShow = status === BookingStatus.COMPLETED && canCorrectAutoNoShow(booking);
    if (!correctingAutoNoShow && !(COURT_BOOKING_TRANSITIONS[booking.bookingStatus] ?? []).includes(status)) {
      throw new ValidationError("Không thể chuyển trạng thái đơn theo thao tác này");
    }
    if (
      (status === BookingStatus.COMPLETED || status === BookingStatus.NO_SHOW) &&
      new Date() < bookingStartsAt(booking.bookingDate, booking.endTime)
    ) {
      throw new ValidationError("Chỉ có thể kết thúc đơn sau giờ đặt sân");
    }

    const cancelReason = reason?.trim();
    if (status === BookingStatus.CANCELLED && (!cancelReason || cancelReason.length < 3)) {
      throw new ValidationError("Nhập lý do huỷ đơn (ít nhất 3 ký tự) để gửi cho khách");
    }

    const { updated, settlement } = await prisma.$transaction(async (tx) => {
      if (status === BookingStatus.COMPLETED) await assertNothingOwed(booking.id, tx);
      const cancellation =
        status === BookingStatus.CANCELLED
          ? courtCancellationPayment(booking.paymentStatus, counterCollectedAmount(booking), await bookingRepository.onlineCollectedAmount(tx, booking))
          : null;
      // Moved only from the status it was read with: staff, another tab or the overdue job acting meanwhile wins.
      const { count } = await tx.booking.updateMany({
        where: { id: booking.id, bookingStatus: booking.bookingStatus },
        data: cancellation
          ? {
              bookingStatus: status,
              cancelReason,
              cancelledAt: new Date(),
              refundAmount: cancellation.refundAmount,
              platformRetainedAmount: 0,
              paymentStatus: cancellation.paymentStatus
            }
          : {
              bookingStatus: status
            }
      });
      if (!count) throw new ConflictError("Đơn vừa được cập nhật ở nơi khác, hãy tải lại trang");
      const updatedBooking = await tx.booking.findUniqueOrThrow({
        where: { id: booking.id },
        include: { court: { include: { partner: true } }, user: { select: { fullName: true, phone: true } } }
      });
      if (cancellation?.refundByAdmin) {
        await enqueueAdminEvent(tx, refundRequiredAdminEvent(updatedBooking, cancellation.refundByAdmin, "Đối tác"));
      }

      let updatedSettlement = null;
      if (status === BookingStatus.COMPLETED || status === BookingStatus.NO_SHOW) {
        updatedSettlement = await settlementService.finishBooking(updatedBooking, status, tx);
      } else if (status === BookingStatus.CANCELLED) {
        await voucherRepository.releaseVoucherUses([booking.id], tx);
        updatedSettlement = await settlementService.cancelForBooking(booking.id, tx);
      }
      // A booking that will not be served gives its services back with the status change, never after it (a failure
      // there undoes both): inventory/inventory.stock.ts releaseBookingStock.
      if (status === BookingStatus.CANCELLED || status === BookingStatus.NO_SHOW) {
        await releaseBookingStock(
          tx,
          booking.id,
          status === BookingStatus.CANCELLED ? "Tự động trả do đơn bị huỷ" : "Tự động trả do khách không đến",
          status === BookingStatus.CANCELLED ? "BOOKING_CANCELLED" : "BOOKING_NO_SHOW"
        );
      }
      return { updated: updatedBooking, settlement: updatedSettlement };
    });

    if (settlement) {
      realtimeService.toPartner(settlement.partnerId, realtimeEvents.settlementUpdated, settlement);
      realtimeService.toAdmin(realtimeEvents.settlementUpdated, settlement);
      realtimeService.toPartner(settlement.partnerId, realtimeEvents.walletUpdated, { partnerId: settlement.partnerId });
      realtimeService.toAdmin(realtimeEvents.walletUpdated, { partnerId: settlement.partnerId });
    }
    await notifyBookingDecision(updated, updated.court.name, status as "CONFIRMED" | "CANCELLED" | "NO_SHOW" | "COMPLETED", {
      reason: cancelReason,
      refundAmount: Number(updated.refundAmount ?? 0)
    });
    return updated;
  },

  /** Same ledger as the wallet and the report (settlements), not the commission ledger kept for admin reconciliation. */
  async revenue(userId: string, month?: string) {
    const profile = await getProfile(userId);
    return settlementService.revenueMonth(profile.id, month);
  },

  async calendar(userId: string, query: { fromDate: string; toDate: string; courtId?: string }) {
    const profile = await getProfile(userId);
    if (query.fromDate > query.toDate) throw new ValidationError("Khoang ngay khong hop le");
    if (!query.courtId) throw new ValidationError("Vui long chon 1 san de xem lich");
    const court = await partnerRepository.courtByPartner(query.courtId, profile.id);
    if (!court) throw new NotFoundError("Khong tim thay san cua ban");
    const items = await partnerRepository.calendar(profile.id, toDbDate(query.fromDate), toDbDate(query.toDate), query.courtId);
    return {
      court: { openingTime: dbTime(court.openingTime), closingTime: dbTime(court.closingTime) },
      items
    };
  },

  async courtSurfaces(userId: string, courtId: string) {
    const profile = await getProfile(userId);
    const court = await partnerRepository.courtByPartner(courtId, profile.id);
    if (!court) throw new NotFoundError("Khong tim thay san cua ban");
    return partnerRepository.courtSurfaces(courtId);
  },

  async updateCourtSurfaceStatus(userId: string, courtId: string, surfaceId: string, status: "ACTIVE" | "INACTIVE") {
    const profile = await getProfile(userId);
    const surface = await partnerRepository.courtSurfaceByPartner(surfaceId, courtId, profile.id);
    if (!surface) throw new NotFoundError("Khong tim thay san con thuoc cum san cua ban");
    const upcoming = status === "INACTIVE" && surface.status !== "INACTIVE" ? await partnerRepository.upcomingBookings(courtId, { surfaceId }) : [];
    const result = await partnerRepository.updateCourtSurfaceStatus(surfaceId, status, "PARTNER");
    realtimeService.toCourt(courtId, realtimeEvents.courtAvailabilityUpdated, { courtId });
    if (upcoming.length) {
      const court = await partnerRepository.courtByPartner(courtId, profile.id);
      await notifyCourtChange(upcoming, { id: courtId, name: court?.name ?? "Sân" }, `tạm ngưng sân con ${surface.name}`);
    }
    return result;
  },

  async createCourtSurface(userId: string, courtId: string, input: CourtSurfaceInput) {
    const profile = await getProfile(userId);
    const court = await partnerRepository.courtByPartner(courtId, profile.id);
    if (!court) throw new NotFoundError("Không tìm thấy cụm sân của bạn");
    const openingTime = input.openingTime ? timeToDate(input.openingTime) : null;
    const closingTime = input.closingTime ? timeToDate(input.closingTime) : null;
    if ((openingTime ?? court.openingTime) >= (closingTime ?? court.closingTime)) {
      throw new ValidationError("Giờ mở cửa phải trước giờ đóng cửa");
    }
    const result = await partnerRepository.saveCourtSurface(courtId, null, { ...input, openingTime, closingTime });
    realtimeService.toCourt(courtId, realtimeEvents.courtAvailabilityUpdated, { courtId });
    return result;
  },

  async deleteCourtSurface(userId: string, courtId: string, surfaceId: string) {
    const profile = await getProfile(userId);
    const surface = await partnerRepository.courtSurfaceByPartner(surfaceId, courtId, profile.id);
    if (!surface) throw new NotFoundError("Không tìm thấy sân con thuộc cụm sân của bạn");
    const result = await partnerRepository.deleteCourtSurface(courtId, surfaceId);
    realtimeService.toCourt(courtId, realtimeEvents.courtAvailabilityUpdated, { courtId });
    return result;
  },

  async updateCourtSurface(userId: string, courtId: string, surfaceId: string, input: Partial<CourtSurfaceInput>) {
    const profile = await getProfile(userId);
    const surface = await partnerRepository.courtSurfaceByPartner(surfaceId, courtId, profile.id);
    if (!surface) throw new NotFoundError("Khong tim thay san con thuoc cum san cua ban");
    const court = await partnerRepository.courtByPartner(courtId, profile.id);
    if (!court) throw new NotFoundError("Không tìm thấy cụm sân của bạn");
    const openingTime = input.openingTime === undefined ? surface.openingTime : input.openingTime ? timeToDate(input.openingTime) : null;
    const closingTime = input.closingTime === undefined ? surface.closingTime : input.closingTime ? timeToDate(input.closingTime) : null;
    if ((openingTime ?? court.openingTime) >= (closingTime ?? court.closingTime)) {
      throw new ValidationError("Giờ mở cửa phải trước giờ đóng cửa");
    }
    const result = await partnerRepository.saveCourtSurface(courtId, surfaceId, {
      code: input.code ?? surface.code, name: input.name ?? surface.name,
      capacity: input.capacity, surface: input.surface, size: input.size,
      openingTime, closingTime
    });
    realtimeService.toCourt(courtId, realtimeEvents.courtAvailabilityUpdated, { courtId });
    return result;
  },

  async courtBlocks(userId: string, courtId: string) {
    const profile = await getProfile(userId);
    const court = await partnerRepository.courtByPartner(courtId, profile.id);
    if (!court) throw new NotFoundError("Khong tim thay san cua ban");
    return partnerRepository.courtBlocks(courtId, toDbDate(vietnamNow().date));
  },

  async createCourtBlock(
    userId: string,
    courtId: string,
    input: { courtSurfaceId?: string | null; blockDate: string; startTime: string; endTime: string; reason?: string }
  ) {
    const profile = await getProfile(userId);
    const court = await partnerRepository.courtByPartner(courtId, profile.id);
    if (!court) throw new NotFoundError("Khong tim thay san cua ban");
    if (timeToMinutes(input.startTime) >= timeToMinutes(input.endTime)) throw new ValidationError("Gio ket thuc phai sau gio bat dau");
    if (input.courtSurfaceId) {
      const surfaces = await partnerRepository.courtSurfaces(courtId);
      if (!surfaces.some((surface) => surface.id === input.courtSurfaceId)) throw new NotFoundError("San con khong thuoc cum san nay");
    }
    const conflicts = await partnerRepository.blockConflicts(courtId, input.courtSurfaceId ?? null, [input.blockDate], input.startTime, input.endTime);
    if (conflicts.length) {
      throw new ConflictError(`Không thể tạo lịch nghỉ: trùng với đơn đã đặt ${listBookings(conflicts)}. Hãy xử lý các đơn này trước.`);
    }
    return partnerRepository.createCourtBlock({
      courtId,
      courtSurfaceId: input.courtSurfaceId ?? null,
      blockDate: toDbDate(input.blockDate),
      startTime: timeToDate(input.startTime),
      endTime: timeToDate(input.endTime),
      reason: input.reason
    });
  },

  async cancelCourtBlock(userId: string, courtId: string, blockId: string) {
    const profile = await getProfile(userId);
    const block = await partnerRepository.blockByCourtAndPartner(blockId, courtId, profile.id);
    if (!block) throw new NotFoundError("Khong tim thay lich nghi nay");
    return partnerRepository.cancelCourtBlock(blockId);
  },

  async courtAvailabilityGrid(userId: string, courtId: string, date: string) {
    const profile = await getProfile(userId);
    const court = await partnerRepository.courtByPartner(courtId, profile.id);
    if (!court) throw new NotFoundError("Khong tim thay san cua ban");

    const dbDate = toDbDate(date);
    const [bookings, bookingSlotsRaw, blocks, holidays] = await Promise.all([
      partnerRepository.courtDayBookings(courtId, dbDate),
      partnerRepository.courtDayBookingSlots(courtId, dbDate),
      partnerRepository.courtDayBlocks(courtId, dbDate),
      holidayRepository.all()
    ]);
    const bookingSlots = bookingSlotsRaw.map((bookingSlot) => ({ ...bookingSlot, courtSurfaceId: bookingSlot.court_surface_id }));

    return (court.surfaces ?? []).map((surface) => {
      const openingTime = surface.openingTime ?? court.openingTime;
      const closingTime = surface.closingTime ?? court.closingTime;
      return {
        surfaceId: surface.id,
        surfaceName: surface.name,
        code: surface.code,
        status: surface.status,
        operatingHours: { open: dbTime(openingTime), close: dbTime(closingTime) },
        slots: buildSlotGrid({
          date,
          openingTime,
          closingTime,
          bookings,
          bookingSlots,
          blocks,
          prices: court.prices,
          holidays,
          courtSurfaceId: surface.id
        })
      };
    });
  },

  async createCourtBlockBulk(
    userId: string,
    courtId: string,
    input: { courtSurfaceId?: string | null; startDate: string; endDate: string; weekdays?: number[]; startTime: string; endTime: string; reason?: string }
  ) {
    const profile = await getProfile(userId);
    const court = await partnerRepository.courtByPartner(courtId, profile.id);
    if (!court) throw new NotFoundError("Khong tim thay san cua ban");
    if (timeToMinutes(input.startTime) >= timeToMinutes(input.endTime)) throw new ValidationError("Gio ket thuc phai sau gio bat dau");
    if (input.startDate > input.endDate) throw new ValidationError("Ngay bat dau phai truoc hoac bang ngay ket thuc");
    if (input.courtSurfaceId && !court.surfaces.some((surface) => surface.id === input.courtSurfaceId)) {
      throw new NotFoundError("San con khong thuoc cum san nay");
    }

    const weekdaySet = input.weekdays && input.weekdays.length ? new Set(input.weekdays) : null;
    const dates: string[] = [];
    const cursor = new Date(`${input.startDate}T00:00:00.000Z`);
    const end = new Date(`${input.endDate}T00:00:00.000Z`);
    while (cursor <= end) {
      if (!weekdaySet || weekdaySet.has(cursor.getUTCDay())) dates.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      if (dates.length > MAX_BULK_BLOCK_DAYS) throw new ValidationError(`Chi duoc chan toi da ${MAX_BULK_BLOCK_DAYS} ngay moi lan`);
    }
    if (!dates.length) throw new ValidationError("Khong co ngay nao phu hop trong khoang da chon");
    const conflicts = await partnerRepository.blockConflicts(courtId, input.courtSurfaceId ?? null, dates, input.startTime, input.endTime);
    if (conflicts.length) {
      throw new ConflictError(`Không thể tạo lịch nghỉ: trùng với đơn đã đặt ${listBookings(conflicts)}. Hãy xử lý các đơn này trước.`);
    }

    const result = await partnerRepository.createCourtBlocks(
      dates.map((blockDate) => ({
        courtId,
        courtSurfaceId: input.courtSurfaceId ?? null,
        blockDate: toDbDate(blockDate),
        startTime: timeToDate(input.startTime),
        endTime: timeToDate(input.endTime),
        reason: input.reason
      }))
    );
    return { created: result.count };
  },

  /**
   * Reviews of the partner's courts, with the average customers see (hidden reviews do not count). Partners read
   * them; hiding or removing a review is the admin's call. Reviewers' emails stay private.
   */
  async reviews(
    userId: string,
    query: { page?: string; limit?: string; courtId?: string; status?: "VISIBLE" | "HIDDEN"; rating?: number; search?: string; replied?: "true" | "false" }
  ) {
    const profile = await getProfile(userId);
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const scope = { partnerId: profile.id, courtId: query.courtId };
    const replied = query.replied === undefined ? undefined : query.replied === "true";
    const [{ items, total }, counts] = await Promise.all([
      reviewRepository.list({ ...scope, status: query.status, rating: query.rating, search: query.search, replied }, page, limit),
      reviewRepository.ratingCounts(scope)
    ]);
    return {
      items: items.map(({ user, ...review }) => ({ ...review, user: { id: user.id, fullName: user.fullName } })),
      meta: paginationMeta(page, limit, total),
      summary: summarizeRatings(counts)
    };
  },

  /**
   * The court owner's public reply to a review of one of their courts, written or rewritten. The customer is told
   * the first time; a hidden review takes no reply since nobody sees it.
   */
  async replyReview(userId: string, reviewId: string, reply: string) {
    const profile = await getProfile(userId);
    const review = await reviewRepository.forPartner(reviewId, profile.id);
    if (!review) throw new NotFoundError("Không tìm thấy đánh giá về sân của bạn");
    if (review.displayStatus === "HIDDEN") throw new ValidationError("Đánh giá đã bị quản trị viên ẩn nên không phản hồi được");
    // A reply an admin took down stays down: posting it (or another) again would undo the moderation.
    const removal = (await replyRemovals([reviewId])).get(reviewId);
    if (removal) {
      throw new ValidationError(
        `Quản trị viên đã gỡ phản hồi của bạn cho đánh giá này${removal.reason ? ` (lý do: ${removal.reason.trim().replace(/[.\s]+$/, "")})` : ""} nên không đăng lại được`
      );
    }
    await reviewRepository.saveReply(reviewId, reply.trim(), userId);
    if (!review.reply) {
      try {
        await notificationService.create({
          userId: review.userId,
          title: "Chủ sân đã phản hồi đánh giá của bạn",
          content: `${profile.businessName} đã phản hồi đánh giá của bạn về sân ${review.court.name}.`,
          type: "REVIEW_REPLIED",
          metadata: { reviewId, courtId: review.courtId }
        });
      } catch (error) {
        // The reply is saved; a failed notice only logs.
        console.error("[ReviewReply] Customer notification failed:", error);
      }
    }
    return { id: reviewId, reply: reply.trim() };
  },

  async deleteReviewReply(userId: string, reviewId: string) {
    const profile = await getProfile(userId);
    const review = await reviewRepository.forPartner(reviewId, profile.id);
    if (!review) throw new NotFoundError("Không tìm thấy đánh giá về sân của bạn");
    if (!review.reply) throw new NotFoundError("Đánh giá này chưa có phản hồi");
    await reviewRepository.deleteReply(reviewId);
    return { id: reviewId, reply: null };
  },

  // Partner posts follow the same lifecycle as users' (blogService); partners keep a draft until they submit.
  async blogs(userId: string) {
    await getProfile(userId);
    return blogService.listMine(userId);
  },

  async blogDetail(userId: string, id: string) {
    await getProfile(userId);
    return blogService.detailMine(id, userId);
  },

  async createBlog(userId: string, input: any) {
    await getProfile(userId);
    return blogService.createMine(userId, input, partnerSave);
  },

  async updateBlog(userId: string, id: string, input: any) {
    await getProfile(userId);
    return blogService.updateMine(id, userId, input, partnerSave);
  },

  async updateBlogComments(userId: string, id: string, allowComments: boolean) {
    await getProfile(userId);
    return blogService.updateMineComments(id, userId, allowComments);
  },

  async submitBlog(userId: string, id: string) {
    await getProfile(userId);
    return blogService.submitMine(id, userId);
  },

  async deleteBlog(userId: string, id: string) {
    await getProfile(userId);
    await blogService.deleteMine(id, userId);
    return { id };
  },

  async listRecipients(userId: string) {
    const profile = await getProfile(userId);
    return partnerRepository.listRecipients(profile.id);
  },

  async createRecipient(userId: string, input: any) {
    const profile = await getProfile(userId);
    const [localPart, domain] = profile.user.email.split("@");
    const recipientEmail = `${localPart}+${input.emailSuffix.trim().toLowerCase()}@${domain}`;

    const existing = await prisma.user.findUnique({ where: { email: recipientEmail } });
    if (existing) throw new ConflictError("Email nhân viên đã tồn tại", "EMAIL_EXISTS");

    const court = await partnerRepository.courtByPartner(input.managedCourtId, profile.id);
    if (!court) throw new ValidationError("Sân được phân công không hợp lệ hoặc không thuộc về bạn");

    const passwordHash = await hashPassword(input.password);
    const created = await partnerRepository.createRecipient(profile.id, {
      fullName: input.fullName.trim(),
      email: recipientEmail,
      passwordHash,
      phone: input.phone,
      managedCourtId: input.managedCourtId
    });

    return created;
  },

  async updateRecipient(userId: string, id: string, input: any) {
    const profile = await getProfile(userId);
    const recipient = await partnerRepository.findRecipient(id, profile.id);
    if (!recipient) throw new NotFoundError("Không tìm thấy nhân viên");

    const updateData: any = {};
    if (input.fullName) updateData.fullName = input.fullName.trim();
    if (input.phone !== undefined) updateData.phone = input.phone.trim() || null;
    if (input.password) {
      updateData.passwordHash = await hashPassword(input.password);
    }
    if (input.managedCourtId && input.managedCourtId !== recipient.managedCourtId) {
      const court = await partnerRepository.courtByPartner(input.managedCourtId, profile.id);
      if (!court) throw new ValidationError("Sân được phân công không hợp lệ");
      updateData.managedCourtId = input.managedCourtId;
    }

    const updated = await partnerRepository.updateRecipient(id, profile.id, updateData);
    // Whoever knew the old password is signed out everywhere.
    if (updateData.passwordHash) await endSessions(id);
    return updated;
  },

  /** Locks a staff account (signed out at once, cannot sign in) or opens it again. */
  async setRecipientStatus(userId: string, id: string, status: "ACTIVE" | "LOCKED") {
    const profile = await getProfile(userId);
    const recipient = await partnerRepository.findRecipient(id, profile.id);
    if (!recipient) throw new NotFoundError("Không tìm thấy nhân viên");
    const updated = await partnerRepository.setRecipientStatus(id, profile.id, status);
    if (status === "LOCKED") await endSessions(id);
    else forgetAccountStatus(id);
    return updated;
  },

  /**
   * Deletes a staff account that never did anything; one that served bookings, ordered stock or left audit rows is
   * locked instead, so the history keeps saying who did it.
   */
  async deleteRecipient(userId: string, id: string) {
    const profile = await getProfile(userId);
    const recipient = await partnerRepository.findRecipient(id, profile.id);
    if (!recipient) throw new NotFoundError("Không tìm thấy nhân viên");

    const lock = async () => {
      await partnerRepository.setRecipientStatus(id, profile.id, "LOCKED");
      await endSessions(id);
      return { id, deleted: false, locked: true };
    };
    if (await partnerRepository.recipientUsed(id)) return lock();
    try {
      await partnerRepository.deleteRecipient(id, profile.id);
    } catch (error: any) {
      // Another table still points at the account (23503): keep it, locked.
      if (error?.code === "P2003" || error?.meta?.code === "23503" || /23503|foreign key/i.test(String(error?.message))) return lock();
      throw error;
    }
    forgetAccountStatus(id);
    realtimeService.disconnectUser(id);
    return { id, deleted: true, locked: false };
  }
};

async function endSessions(userId: string) {
  await authRepository.revokeAllSessions(userId);
  forgetAccountStatus(userId);
  realtimeService.disconnectUser(userId);
}
