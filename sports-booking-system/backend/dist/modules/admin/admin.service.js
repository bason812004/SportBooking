import { NotFoundError } from "../../shared/errors/AppError.js";
import { paginationMeta } from "../../shared/utils/response.js";
import { parseLimit, parsePage } from "../../shared/utils/time.js";
import { slugify } from "../../shared/utils/slug.js";
import { adminRepository } from "./admin.repository.js";
export const adminService = {
    async dashboard() {
        const [users, partners, courts, bookings, revenue] = await adminRepository.dashboard();
        return { users, partners, courts, bookings, revenue: Number(revenue._sum.totalPrice ?? 0) };
    },
    async users(query) {
        const page = parsePage(query.page);
        const limit = parseLimit(query.limit);
        const [items, total] = await adminRepository.users(page, limit);
        return { items, meta: paginationMeta(page, limit, total) };
    },
    lockUser(id) {
        return adminRepository.setUserStatus(id, "LOCKED");
    },
    unlockUser(id) {
        return adminRepository.setUserStatus(id, "ACTIVE");
    },
    async partners(query) {
        const page = parsePage(query.page);
        const limit = parseLimit(query.limit);
        const [items, total] = await adminRepository.partners(page, limit);
        return { items, meta: paginationMeta(page, limit, total) };
    },
    approvePartner(id) {
        return adminRepository.setPartnerApproval(id, "APPROVED");
    },
    rejectPartner(id) {
        return adminRepository.setPartnerApproval(id, "REJECTED");
    },
    pendingCourts() {
        return adminRepository.pendingCourts();
    },
    approveCourt(id) {
        return adminRepository.setCourtApproval(id, "APPROVED", null);
    },
    rejectCourt(id, reason) {
        return adminRepository.setCourtApproval(id, "REJECTED", reason);
    },
    categories() {
        return adminRepository.categories();
    },
    createCategory(input) {
        return adminRepository.createCategory({ ...input, slug: input.slug ?? slugify(input.name) });
    },
    updateCategory(id, input) {
        return adminRepository.updateCategory(id, { ...input, slug: input.slug ?? (input.name ? slugify(input.name) : undefined) });
    },
    deleteCategory(id) {
        return adminRepository.deleteCategory(id);
    },
    reviews() {
        return adminRepository.reviews();
    },
    hideReview(id) {
        return adminRepository.setReviewDisplay(id, "HIDDEN");
    },
    showReview(id) {
        return adminRepository.setReviewDisplay(id, "VISIBLE");
    },
    deleteReview(id) {
        return adminRepository.deleteReview(id);
    },
    reports() {
        return adminRepository.reports();
    },
    resolveReport(id) {
        return adminRepository.setReportStatus(id, "RESOLVED");
    },
    rejectReport(id) {
        return adminRepository.setReportStatus(id, "REJECTED");
    },
    async statistics() {
        const [bookings, courtsByCity, reviews] = await adminRepository.statistics();
        return { bookings, courtsByCity, reviews };
    },
    notFound() {
        throw new NotFoundError();
    }
};
