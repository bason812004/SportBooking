import { env } from "../../config/env.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { calculateDemandScore, type DemandScoreResult } from "../../shared/utils/businessRules.js";
import { dayTypeFor, timeToMinutes } from "../../shared/utils/time.js";
import { trackEvent } from "../analytics/analytics.service.js";
import { demandPredictionRepository } from "./demandPrediction.repository.js";

const RULE_BASED_MODEL_VERSION = "rule-based-v1";
const ML_MODEL_VERSION = "ml-random-forest-v1";

type MlPredictResponse = {
  predicted_demand_score: number;
  predicted_occupancy_rate: number;
  prediction_level: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  confidence_score: number;
};

async function predictWithMlModel(input: {
  hourOfDay: number;
  dayOfWeek: number;
  isWeekend: boolean;
  sportType: string;
  bookingCount: number;
  cancellationCount: number;
  voucherUsageCount: number;
  averagePrice: number;
}): Promise<DemandScoreResult | null> {
  if (!env.ML_SERVICE_URL) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.ML_SERVICE_TIMEOUT_MS);

  try {
    const response = await fetch(`${env.ML_SERVICE_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        hour_of_day: input.hourOfDay,
        day_of_week: input.dayOfWeek,
        is_weekend: input.isWeekend,
        sport_type: input.sportType,
        booking_count: input.bookingCount,
        cancellation_count: input.cancellationCount,
        voucher_usage_count: input.voucherUsageCount,
        average_price: input.averagePrice
      })
    });
    if (!response.ok) return null;

    const body = (await response.json()) as MlPredictResponse;
    return {
      status: "GENERATED",
      predictedDemandScore: body.predicted_demand_score,
      predictedOccupancyRate: body.predicted_occupancy_rate,
      predictionLevel: body.prediction_level,
      confidenceScore: body.confidence_score
    };
  } catch {
    // ML service unavailable or timed out: caller falls back to rule-based prediction.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

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

function isPeakHour(startTime: string) {
  const minutes = timeToMinutes(startTime);
  return minutes >= timeToMinutes("17:00") && minutes < timeToMinutes("21:00");
}

async function partnerProfile(userId: string) {
  const profile = await demandPredictionRepository.partnerProfile(userId);
  if (!profile) throw new ForbiddenError("Tai khoan doi tac chua co ho so");
  return profile;
}

export const demandPredictionService = {
  async predict(courtId: string, input: { date: string; startTime: string; endTime: string }) {
    if (timeToMinutes(input.startTime) >= timeToMinutes(input.endTime)) throw new ValidationError("Gio bat dau phai nho hon gio ket thuc");
    const court = await demandPredictionRepository.court(courtId);
    if (!court) throw new NotFoundError("San khong ton tai hoac chua duoc duyet");

    const [totalHistoricalBookings, matchingSlotBookings, cancellationCount, averageRows, slotStatsRows] = await Promise.all([
      demandPredictionRepository.totalHistoricalBookings(courtId),
      demandPredictionRepository.matchingSlotBookings(courtId, input.startTime, input.endTime),
      demandPredictionRepository.cancellationCount(courtId),
      demandPredictionRepository.averageComparableSlotBookings(courtId),
      demandPredictionRepository.slotPriceAndVoucherStats(courtId, input.startTime, input.endTime)
    ]);

    const isWeekend = dayTypeFor(input.date) === "WEEKEND";
    let modelVersion = RULE_BASED_MODEL_VERSION;
    let result: DemandScoreResult | null = null;

    if (totalHistoricalBookings >= env.ML_MIN_HISTORY) {
      const mlResult = await predictWithMlModel({
        hourOfDay: Math.floor(timeToMinutes(input.startTime) / 60),
        dayOfWeek: new Date(`${input.date}T00:00:00.000Z`).getUTCDay(),
        isWeekend,
        sportType: court.category.slug,
        bookingCount: matchingSlotBookings,
        cancellationCount,
        voucherUsageCount: Number(slotStatsRows[0]?.voucherUsageCount ?? 0),
        averagePrice: slotStatsRows[0]?.averagePrice ?? 0
      });
      if (mlResult) {
        result = mlResult;
        modelVersion = ML_MODEL_VERSION;
      }
    }

    if (!result) {
      result = calculateDemandScore({
        totalHistoricalBookings,
        matchingSlotBookings,
        averageBookingsPerComparableSlot: averageRows[0]?.average ?? 0,
        isWeekend,
        isPeakHour: isPeakHour(input.startTime),
        cancellationCount
      });
    }

    await demandPredictionRepository.savePrediction({
      courtId,
      predictionDate: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      predictedDemandScore: result.predictedDemandScore,
      predictedOccupancyRate: result.predictedOccupancyRate,
      confidenceScore: result.confidenceScore,
      predictionLevel: result.predictionLevel,
      status: result.status,
      modelVersion
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
      modelVersion,
      message: result.status === "INSUFFICIENT_DATA" ? messages.INSUFFICIENT_DATA : messages[result.predictionLevel]
    };
  },

  /**
   * Bulk demand-resolution for a whole week. Fetches every aggregate we
   * need with three queries (court + per-court historical counts + a per-
   * start_time breakdown of matching bookings across the court), then
   * computes the prediction level for every slot in memory. This replaces
   * the previous per-slot path which executed ~6 queries + 1 insert per
   * slot (≈ 700+ DB hits per request) and choked the Supabase pooler.
   */
  async predictForWeek(input: { courtId: string; weekStart: string; weekEnd: string }) {
    const court = await demandPredictionRepository.court(input.courtId);
    if (!court) throw new NotFoundError("San khong ton tai hoac chua duoc duyet");

    const [totalHistoricalBookings, cancellationCount, matchingCounts, averageRows] = await Promise.all([
      demandPredictionRepository.totalHistoricalBookings(input.courtId),
      demandPredictionRepository.cancellationCount(input.courtId),
      demandPredictionRepository.bookingCountsByStartTime(input.courtId),
      demandPredictionRepository.averageComparableSlotBookings(input.courtId)
    ]);

    return {
      courtId: input.courtId,
      partnerId: court.partnerId,
      totalHistoricalBookings,
      cancellationCount,
      averageBookingsPerComparableSlot: Number(averageRows[0]?.average ?? 0),
      // Map keyed by `${startTime}-${endTime}` for O(1) lookup per slot.
      matchingCountsByWindow: matchingCounts.reduce<Record<string, number>>((acc, row) => {
        acc[`${row.startTime}-${row.endTime}`] = row.count;
        return acc;
      }, {})
    };
  },

  async overview(userId: string) {
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

  async courtOverview(userId: string, courtId: string) {
    const profile = await partnerProfile(userId);
    const court = await demandPredictionRepository.partnerCourt(courtId, profile.id);
    if (!court) throw new ForbiddenError("Chi duoc xem du doan cho san cua ban");
    const totalHistoricalBookings = await demandPredictionRepository.totalHistoricalBookings(courtId);
    return { courtId, totalHistoricalBookings, status: totalHistoricalBookings >= 20 ? "READY" : "INSUFFICIENT_DATA" };
  },

  async peakHours(userId: string) {
    const profile = await partnerProfile(userId);
    const rows = await demandPredictionRepository.partnerPeakHours(profile.id);
    return rows.map((row) => ({ courtId: row.courtId, courtName: row.courtName, hour: row.hour, bookingCount: Number(row.bookingCount) }));
  }
};
