import { ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { calculateDemandScore } from "../../shared/utils/businessRules.js";
import { dayTypeFor, timeToMinutes } from "../../shared/utils/time.js";
import { trackEvent } from "../analytics/analytics.service.js";
import { demandPredictionRepository } from "./demandPrediction.repository.js";
const messages = {
    INSUFFICIENT_DATA: {
        vi: "Chua du du lieu de du doan nhu cau.",
        en: "Not enough data to predict demand."
    },
    LOW: {
        vi: "Khung gio nay co nhu cau thap.",
        en: "This time slot has low demand."
    },
    MEDIUM: {
        vi: "Khung gio nay co nhu cau trung binh.",
        en: "This time slot has moderate demand."
    },
    HIGH: {
        vi: "Khung gio nay co nhu cau cao.",
        en: "This time slot has high demand."
    },
    VERY_HIGH: {
        vi: "Kha nang kin san rat cao vao khung gio nay.",
        en: "This time slot has a very high chance of being fully booked."
    }
};
function isPeakHour(startTime) {
    const minutes = timeToMinutes(startTime);
    return minutes >= timeToMinutes("17:00") && minutes < timeToMinutes("21:00");
}
async function partnerProfile(userId) {
    const profile = await demandPredictionRepository.partnerProfile(userId);
    if (!profile)
        throw new ForbiddenError("Tai khoan doi tac chua co ho so");
    return profile;
}
export const demandPredictionService = {
    async predict(courtId, input) {
        if (timeToMinutes(input.startTime) >= timeToMinutes(input.endTime))
            throw new ValidationError("Gio bat dau phai nho hon gio ket thuc");
        const court = await demandPredictionRepository.court(courtId);
        if (!court)
            throw new NotFoundError("San khong ton tai hoac chua duoc duyet");
        const [totalHistoricalBookings, matchingSlotBookings, cancellationCount, averageRows] = await Promise.all([
            demandPredictionRepository.totalHistoricalBookings(courtId),
            demandPredictionRepository.matchingSlotBookings(courtId, input.startTime, input.endTime),
            demandPredictionRepository.cancellationCount(courtId),
            demandPredictionRepository.averageComparableSlotBookings(courtId)
        ]);
        const result = calculateDemandScore({
            totalHistoricalBookings,
            matchingSlotBookings,
            averageBookingsPerComparableSlot: averageRows[0]?.average ?? 0,
            isWeekend: dayTypeFor(input.date) === "WEEKEND",
            isPeakHour: isPeakHour(input.startTime),
            cancellationCount
        });
        await demandPredictionRepository.savePrediction({
            courtId,
            predictionDate: input.date,
            startTime: input.startTime,
            endTime: input.endTime,
            predictedDemandScore: result.predictedDemandScore,
            predictedOccupancyRate: result.predictedOccupancyRate,
            confidenceScore: result.confidenceScore,
            predictionLevel: result.predictionLevel,
            status: result.status
        });
        await trackEvent({
            partnerId: court.partnerId,
            eventType: "DEMAND_PREDICTION_GENERATED",
            entityType: "COURT",
            entityId: courtId,
            metadataJson: { date: input.date, startTime: input.startTime, endTime: input.endTime, status: result.status }
        });
        return {
            courtId,
            predictedDemandScore: result.predictedDemandScore,
            predictedOccupancyRate: result.predictedOccupancyRate,
            predictionLevel: result.predictionLevel,
            confidenceScore: result.confidenceScore,
            status: result.status,
            message: result.status === "INSUFFICIENT_DATA" ? messages.INSUFFICIENT_DATA : messages[result.predictionLevel]
        };
    },
    async overview(userId) {
        const profile = await partnerProfile(userId);
        const peakHours = await demandPredictionRepository.partnerPeakHours(profile.id);
        return {
            peakHours: peakHours.map((row) => ({
                courtId: row.courtId,
                courtName: row.courtName,
                hour: row.hour,
                bookingCount: Number(row.bookingCount)
            }))
        };
    },
    async courtOverview(userId, courtId) {
        const profile = await partnerProfile(userId);
        const court = await demandPredictionRepository.partnerCourt(courtId, profile.id);
        if (!court)
            throw new ForbiddenError("Chi duoc xem du doan cho san cua ban");
        const totalHistoricalBookings = await demandPredictionRepository.totalHistoricalBookings(courtId);
        return { courtId, totalHistoricalBookings, status: totalHistoricalBookings >= 20 ? "READY" : "INSUFFICIENT_DATA" };
    },
    async peakHours(userId) {
        const profile = await partnerProfile(userId);
        const rows = await demandPredictionRepository.partnerPeakHours(profile.id);
        return rows.map((row) => ({ courtId: row.courtId, courtName: row.courtName, hour: row.hour, bookingCount: Number(row.bookingCount) }));
    }
};
