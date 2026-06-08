import { supabaseStorage } from "../../config/storage.js";
import { env } from "../../config/env.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { paginationMeta } from "../../shared/utils/response.js";
import { parseLimit, parsePage, timeToDate, timeToMinutes } from "../../shared/utils/time.js";
import { uniqueSlug } from "../../shared/utils/slug.js";
import { partnerRepository } from "./partner.repository.js";
async function getProfile(userId) {
    const profile = await partnerRepository.profileByUser(userId);
    if (!profile)
        throw new ForbiddenError("Tai khoan doi tac chua co ho so");
    return profile;
}
export const partnerService = {
    async dashboard(userId) {
        const profile = await getProfile(userId);
        const [courts, bookings, revenue] = await partnerRepository.dashboard(profile.id);
        return { courts, bookings, revenue: Number(revenue._sum.totalPrice ?? 0) };
    },
    async courts(userId) {
        const profile = await getProfile(userId);
        return partnerRepository.listCourts(profile.id);
    },
    async courtDetail(userId, courtId) {
        const profile = await getProfile(userId);
        const court = await partnerRepository.courtByPartner(courtId, profile.id);
        if (!court)
            throw new NotFoundError("Khong tim thay san cua ban");
        return court;
    },
    async createCourt(userId, input) {
        const profile = await getProfile(userId);
        if (timeToMinutes(input.openingTime) >= timeToMinutes(input.closingTime))
            throw new ValidationError("Gio mo cua khong hop le");
        return partnerRepository.createCourt({
            partnerId: profile.id,
            categoryId: input.categoryId,
            name: input.name,
            slug: uniqueSlug(input.name),
            description: input.description,
            address: input.address,
            city: input.city,
            district: input.district,
            ward: input.ward,
            latitude: input.latitude,
            longitude: input.longitude,
            openingTime: timeToDate(input.openingTime),
            closingTime: timeToDate(input.closingTime),
            approvalStatus: "PENDING",
            activeStatus: "ACTIVE"
        });
    },
    async updateCourt(userId, courtId, input) {
        const profile = await getProfile(userId);
        const existing = await partnerRepository.courtByPartner(courtId, profile.id);
        if (!existing)
            throw new NotFoundError("Khong tim thay san cua ban");
        return partnerRepository.updateCourt(courtId, {
            ...input,
            slug: input.name ? uniqueSlug(input.name) : undefined,
            openingTime: input.openingTime ? timeToDate(input.openingTime) : undefined,
            closingTime: input.closingTime ? timeToDate(input.closingTime) : undefined,
            approvalStatus: "PENDING"
        });
    },
    async deactivateCourt(userId, courtId) {
        const profile = await getProfile(userId);
        const existing = await partnerRepository.courtByPartner(courtId, profile.id);
        if (!existing)
            throw new NotFoundError("Khong tim thay san cua ban");
        return partnerRepository.updateCourt(courtId, { activeStatus: "INACTIVE" });
    },
    async addImage(userId, courtId, input, file) {
        const profile = await getProfile(userId);
        const court = await partnerRepository.courtByPartner(courtId, profile.id);
        if (!court)
            throw new NotFoundError("Khong tim thay san cua ban");
        let imageUrl = input.imageUrl;
        if (file) {
            if (!supabaseStorage)
                throw new ValidationError("Chua cau hinh Supabase Storage");
            if (!file.mimetype.startsWith("image/"))
                throw new ValidationError("File phai la anh");
            if (file.size > 3 * 1024 * 1024)
                throw new ValidationError("Anh toi da 3MB");
            const path = `${courtId}/${Date.now()}-${file.originalname}`;
            const { error } = await supabaseStorage.storage.from(env.SUPABASE_STORAGE_BUCKET).upload(path, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });
            if (error)
                throw new ValidationError(error.message);
            imageUrl = supabaseStorage.storage.from(env.SUPABASE_STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
        }
        if (!imageUrl)
            throw new ValidationError("Can imageUrl hoac file anh");
        const image = await partnerRepository.addImage({ courtId, imageUrl, sortOrder: input.sortOrder ?? 0 });
        await partnerRepository.updateCourt(courtId, { approvalStatus: "PENDING" });
        return image;
    },
    async addPrice(userId, courtId, input) {
        const profile = await getProfile(userId);
        const court = await partnerRepository.courtByPartner(courtId, profile.id);
        if (!court)
            throw new NotFoundError("Khong tim thay san cua ban");
        return partnerRepository.addPrice({
            courtId,
            dayType: input.dayType,
            startTime: timeToDate(input.startTime),
            endTime: timeToDate(input.endTime),
            price: input.price,
            note: input.note
        });
    },
    async updatePrice(userId, priceId, input) {
        const profile = await getProfile(userId);
        if (!(await partnerRepository.priceByPartner(priceId, profile.id)))
            throw new NotFoundError("Khong tim thay bang gia");
        return partnerRepository.updatePrice(priceId, {
            dayType: input.dayType,
            startTime: input.startTime ? timeToDate(input.startTime) : undefined,
            endTime: input.endTime ? timeToDate(input.endTime) : undefined,
            price: input.price,
            note: input.note
        });
    },
    async deletePrice(userId, priceId) {
        const profile = await getProfile(userId);
        if (!(await partnerRepository.priceByPartner(priceId, profile.id)))
            throw new NotFoundError("Khong tim thay bang gia");
        return partnerRepository.deletePrice(priceId);
    },
    async addService(userId, courtId, input) {
        const profile = await getProfile(userId);
        const court = await partnerRepository.courtByPartner(courtId, profile.id);
        if (!court)
            throw new NotFoundError("Khong tim thay san cua ban");
        return partnerRepository.addService({ courtId, ...input, status: input.status ?? "ACTIVE" });
    },
    async updateService(userId, serviceId, input) {
        const profile = await getProfile(userId);
        if (!(await partnerRepository.serviceByPartner(serviceId, profile.id)))
            throw new NotFoundError("Khong tim thay dich vu");
        return partnerRepository.updateService(serviceId, input);
    },
    async deleteService(userId, serviceId) {
        const profile = await getProfile(userId);
        if (!(await partnerRepository.serviceByPartner(serviceId, profile.id)))
            throw new NotFoundError("Khong tim thay dich vu");
        return partnerRepository.deleteService(serviceId);
    },
    async bookings(userId, query) {
        const profile = await getProfile(userId);
        const page = parsePage(query.page);
        const limit = parseLimit(query.limit);
        const [items, total] = await partnerRepository.bookings(profile.id, page, limit);
        return { items, meta: paginationMeta(page, limit, total) };
    },
    async updateBookingStatus(userId, bookingId, status) {
        const profile = await getProfile(userId);
        if (!(await partnerRepository.bookingByPartner(bookingId, profile.id)))
            throw new NotFoundError("Khong tim thay don cua san ban");
        return partnerRepository.updateBookingStatus(bookingId, status);
    },
    async revenue(userId) {
        const profile = await getProfile(userId);
        return partnerRepository.revenue(profile.id);
    }
};
