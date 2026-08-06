import { NotFoundError } from "../../shared/errors/AppError.js";
import { ConflictError, ForbiddenError, ValidationError } from "../../shared/errors/AppError.js";
import { isTournamentRegistrationAllowed } from "../../shared/utils/businessRules.js";
import { uniqueSlug } from "../../shared/utils/slug.js";
import { trackEvent } from "../analytics/analytics.service.js";
import { notificationService } from "../notifications/notification.service.js";
import { tournamentRepository } from "./tournament.repository.js";
export const tournamentService = {
    list() {
        return tournamentRepository.listPublic();
    },
    async detail(slug) {
        const [tournament] = await tournamentRepository.findPublicBySlug(slug);
        if (!tournament)
            throw new NotFoundError("Khong tim thay giai dau");
        return tournament;
    },
    async register(userId, id, input) {
        const tournament = await tournamentRepository.findPublicById(id);
        if (!tournament)
            throw new NotFoundError("Khong tim thay giai dau");
        const existing = await tournamentRepository.registration(id, userId);
        const allowed = isTournamentRegistrationAllowed({
            status: tournament.status,
            registrationDeadline: tournament.registrationDeadline,
            currentParticipants: tournament.currentParticipants,
            maxParticipants: tournament.maxParticipants,
            alreadyRegistered: Boolean(existing)
        });
        if (!allowed.allowed) {
            if (allowed.reason === "ALREADY_REGISTERED")
                throw new ConflictError("Ban da dang ky giai dau nay", "TOURNAMENT_ALREADY_REGISTERED");
            throw new ValidationError(`Khong the dang ky giai dau: ${allowed.reason}`);
        }
        const registration = await tournamentRepository.register({ tournamentId: id, userId, ...input });
        await trackEvent({ userId, partnerId: tournament.partnerId, eventType: "TOURNAMENT_REGISTERED", entityType: "TOURNAMENT", entityId: id });
        return registration;
    },
    async listPartner(userId) {
        const profile = await tournamentRepository.partnerProfile(userId);
        if (!profile)
            throw new ForbiddenError("Tai khoan doi tac chua co ho so");
        const tournaments = await tournamentRepository.listPartner(profile.id);
        return tournaments.map(({ court, ...rest }) => ({ ...rest, entryFee: Number(rest.entryFee), courtName: court.name }));
    },
    async createPartner(userId, input) {
        const profile = await tournamentRepository.partnerProfile(userId);
        if (!profile)
            throw new ForbiddenError("Tai khoan doi tac chua co ho so");
        if (!(await tournamentRepository.partnerCourt(input.courtId, profile.id)))
            throw new ForbiddenError("Chi duoc tao giai cho san cua ban");
        const tournament = await tournamentRepository.createPartner(profile.id, uniqueSlug(input.title), input);
        await trackEvent({ partnerId: profile.id, eventType: "TOURNAMENT_CREATED", entityType: "TOURNAMENT", entityId: tournament.id });
        await notificationService.notifyAdmins({
            title: "Giải đấu mới cần duyệt",
            content: `${profile.businessName} vừa tạo giải đấu "${tournament.title}", cần duyệt.`,
            type: "TOURNAMENT_CREATED",
            metadata: { tournamentId: tournament.id }
        });
        return tournament;
    },
    async getPartner(userId, id) {
        const profile = await tournamentRepository.partnerProfile(userId);
        if (!profile)
            throw new ForbiddenError("Tai khoan doi tac chua co ho so");
        const tournament = await tournamentRepository.findPartnerTournament(id, profile.id);
        if (!tournament)
            throw new NotFoundError("Khong tim thay giai dau cua ban");
        return { ...tournament, entryFee: Number(tournament.entryFee) };
    },
    async updatePartner(userId, id, input) {
        const profile = await tournamentRepository.partnerProfile(userId);
        if (!profile)
            throw new ForbiddenError("Tai khoan doi tac chua co ho so");
        if (!(await tournamentRepository.findPartnerTournament(id, profile.id)))
            throw new NotFoundError("Khong tim thay giai dau cua ban");
        if (input.courtId && !(await tournamentRepository.partnerCourt(input.courtId, profile.id))) {
            throw new ForbiddenError("Chi duoc cap nhat giai cho san cua ban");
        }
        return tournamentRepository.updatePartner(id, input.title ? uniqueSlug(input.title) : undefined, input);
    },
    async deletePartner(userId, id) {
        await this.getPartner(userId, id);
        return tournamentRepository.deletePartner(id);
    },
    async registrations(userId, id) {
        const profile = await tournamentRepository.partnerProfile(userId);
        if (!profile)
            throw new ForbiddenError("Tai khoan doi tac chua co ho so");
        if (!(await tournamentRepository.findPartnerTournament(id, profile.id)))
            throw new NotFoundError("Khong tim thay giai dau cua ban");
        return tournamentRepository.registrations(id, profile.id);
    },
    async updateRegistration(userId, id, status) {
        const profile = await tournamentRepository.partnerProfile(userId);
        if (!profile)
            throw new ForbiddenError("Tai khoan doi tac chua co ho so");
        if (!(await tournamentRepository.registrationByPartner(id, profile.id)))
            throw new NotFoundError("Khong tim thay dang ky");
        return tournamentRepository.updateRegistration(id, status);
    }
};
