import { timeToMinutes } from "./time.js";
export function calculateDynamicPrice(input) {
    const adjustments = [];
    let finalPrice = input.basePrice;
    for (const rule of input.rules) {
        const amount = rule.type === "PERCENTAGE" ? Math.round((input.basePrice * rule.value) / 100) : rule.value;
        finalPrice += amount;
        if (rule.minPrice != null)
            finalPrice = Math.max(finalPrice, rule.minPrice);
        if (rule.maxPrice != null)
            finalPrice = Math.min(finalPrice, rule.maxPrice);
        adjustments.push({ ruleName: rule.ruleName, type: rule.type, value: rule.value, amount });
    }
    return {
        basePrice: input.basePrice,
        adjustments,
        dynamicAdjustmentAmount: adjustments.reduce((sum, item) => sum + item.amount, 0),
        finalPrice: Math.max(0, Math.round(finalPrice))
    };
}
export function calculateVoucherDiscount(input) {
    if (input.subtotal < (input.minBookingAmount ?? 0)) {
        return { discountAmount: 0, finalTotal: input.subtotal };
    }
    const rawDiscount = input.discountType === "PERCENTAGE" ? Math.round((input.subtotal * input.discountValue) / 100) : input.discountValue;
    const cappedDiscount = input.maxDiscountAmount == null ? rawDiscount : Math.min(rawDiscount, input.maxDiscountAmount);
    const discountAmount = Math.max(0, Math.min(input.subtotal, Math.round(cappedDiscount)));
    return {
        discountAmount,
        finalTotal: Math.max(0, Math.round(input.subtotal - discountAmount))
    };
}
export function calculateDemandScore(input) {
    const minHistory = input.minHistory ?? 20;
    if (input.totalHistoricalBookings < minHistory) {
        return {
            status: "INSUFFICIENT_DATA",
            predictedDemandScore: null,
            predictedOccupancyRate: null,
            predictionLevel: null,
            confidenceScore: 0
        };
    }
    const comparable = Math.max(input.averageBookingsPerComparableSlot, 1);
    const relativeDemand = Math.min(input.matchingSlotBookings / comparable, 2);
    const weekendBoost = input.isWeekend ? 12 : 0;
    const peakBoost = input.isPeakHour ? 18 : 0;
    const cancellationPenalty = Math.min(input.cancellationCount ?? 0, 10);
    const predictedDemandScore = Math.max(0, Math.min(100, Math.round(relativeDemand * 35 + weekendBoost + peakBoost - cancellationPenalty)));
    const predictedOccupancyRate = Math.max(0, Math.min(1, Number((predictedDemandScore / 100).toFixed(2))));
    const predictionLevel = predictedDemandScore >= 80 ? "VERY_HIGH" : predictedDemandScore >= 60 ? "HIGH" : predictedDemandScore >= 35 ? "MEDIUM" : "LOW";
    return {
        status: "GENERATED",
        predictedDemandScore,
        predictedOccupancyRate,
        predictionLevel,
        confidenceScore: Number(Math.min(0.95, 0.45 + input.totalHistoricalBookings / 200).toFixed(2))
    };
}
export function predictCourtDemand(input) {
    return calculateDemandScore(input);
}
export function calculateOccupancyRate(input) {
    if (input.totalSlots <= 0)
        return 0;
    return Number(Math.min(1, Math.max(0, input.bookedSlots / input.totalSlots)).toFixed(4));
}
export function calculateRevenueLift(input) {
    if (input.fixedRevenue <= 0)
        return input.dynamicRevenue > 0 ? 1 : 0;
    return Number(((input.dynamicRevenue - input.fixedRevenue) / input.fixedRevenue).toFixed(4));
}
export function checkBookingOverlap(input) {
    const start = timeToMinutes(input.startTime);
    const end = timeToMinutes(input.endTime);
    return input.existing.some((booking) => start < timeToMinutes(booking.endTime) && end > timeToMinutes(booking.startTime));
}
export function isTournamentRegistrationAllowed(input) {
    const now = input.now ?? new Date();
    if (input.alreadyRegistered)
        return { allowed: false, reason: "ALREADY_REGISTERED" };
    if (!["OPEN", "APPROVED"].includes(input.status))
        return { allowed: false, reason: "NOT_OPEN" };
    if (now > input.registrationDeadline)
        return { allowed: false, reason: "DEADLINE_PASSED" };
    if (input.currentParticipants >= input.maxParticipants)
        return { allowed: false, reason: "FULL" };
    return { allowed: true, reason: null };
}
