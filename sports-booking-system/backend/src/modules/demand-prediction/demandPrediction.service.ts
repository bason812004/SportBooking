import { env } from "../../config/env.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { calculateDemandScore, type DemandScoreResult } from "../../shared/utils/businessRules.js";
import { dayTypeFor, timeToMinutes, vietnamNow } from "../../shared/utils/time.js";
import { trackEvent } from "../analytics/analytics.service.js";
import {
  fromMlResponse,
  historyCutoff,
  isPeakHour,
  ML_MODEL_VERSION,
  resolveSlotDemand,
  RULE_BASED_MIN_HISTORY,
  RULE_BASED_MODEL_VERSION,
  slotKey,
  slotPatternKey,
  toMlRequestRow,
  type DemandHistoryBundle,
  type MlPredictResponse,
  type MlRequestRow,
  type SlotPatternStats
} from "./demandPrediction.features.js";
import { demandPredictionRepository } from "./demandPrediction.repository.js";

type SlotInput = { date: string; startTime: string };

async function requestMlBatch(rows: MlRequestRow[]): Promise<MlPredictResponse[] | null> {
  if (!env.ML_SERVICE_URL || rows.length === 0) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.ML_SERVICE_TIMEOUT_MS);

  try {
    const response = await fetch(`${env.ML_SERVICE_URL}/predict/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ items: rows })
    });
    if (!response.ok) return null;

    const body = (await response.json()) as { predictions?: MlPredictResponse[] };
    if (!Array.isArray(body.predictions) || body.predictions.length !== rows.length) return null;
    return body.predictions;
  } catch {
    // ML service unavailable or timed out: caller falls back to rule-based prediction.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Scores the given slots with the ML service in one batch call. Returns an empty
 * map (= use rule-based) when ML is not configured, the court has too little
 * history, a slot pattern has never been seen, or the service fails.
 */
async function mlPredictSlots(input: {
  courtId: string;
  sportType: string;
  totalHistoricalBookings: number;
  slots: SlotInput[];
}): Promise<Map<string, DemandScoreResult>> {
  const predictions = new Map<string, DemandScoreResult>();
  if (!env.ML_SERVICE_URL || input.totalHistoricalBookings < env.ML_MIN_HISTORY || input.slots.length === 0) return predictions;

  try {
    // Features only use weeks before the predicted week, exactly like training.
    const today = vietnamNow().date;
    const cutoffs = [...new Set(input.slots.map((slot) => historyCutoff(slot.date, today)))];
    const statsByCutoff = new Map<string, Map<string, SlotPatternStats>>();
    await Promise.all(
      cutoffs.map(async (cutoff) => {
        const rows = await demandPredictionRepository.slotPatternStats(input.courtId, cutoff);
        statsByCutoff.set(cutoff, new Map(rows.map((row) => [slotPatternKey(row.dow, row.hour), row])));
      })
    );

    const keys: string[] = [];
    const rows: MlRequestRow[] = [];
    for (const slot of input.slots) {
      const row = toMlRequestRow({
        date: slot.date,
        startTime: slot.startTime,
        sportType: input.sportType,
        statsByPattern: statsByCutoff.get(historyCutoff(slot.date, today)) ?? new Map()
      });
      if (!row) continue;
      keys.push(slotKey(slot.date, slot.startTime));
      rows.push(row);
    }

    const responses = await requestMlBatch(rows);
    responses?.forEach((body, index) => predictions.set(keys[index], fromMlResponse(body)));
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[demand-prediction] ML scoring failed, using rule-based", input.courtId, error);
    }
  }
  return predictions;
}

async function buildDemandBundle(court: { id: string; category: { slug: string } }, slots: SlotInput[]): Promise<DemandHistoryBundle> {
  const [totalHistoricalBookings, cancellationCount, matchingCounts, averageRows] = await Promise.all([
    demandPredictionRepository.totalHistoricalBookings(court.id),
    demandPredictionRepository.cancellationCount(court.id),
    demandPredictionRepository.bookingCountsByStartTime(court.id),
    demandPredictionRepository.averageComparableSlotBookings(court.id)
  ]);
  const mlPredictions = await mlPredictSlots({ courtId: court.id, sportType: court.category.slug, totalHistoricalBookings, slots });

  return {
    totalHistoricalBookings,
    cancellationCount,
    averageBookingsPerComparableSlot: Number(averageRows[0]?.average ?? 0),
    // Map keyed by `${startTime}-${endTime}` for O(1) lookup per slot.
    matchingCountsByWindow: matchingCounts.reduce<Record<string, number>>((acc, row) => {
      acc[`${row.startTime}-${row.endTime}`] = row.count;
      return acc;
    }, {}),
    mlPredictions: Object.fromEntries(mlPredictions)
  };
}

function hourlySlots(openingTime: Date, closingTime: Date) {
  const open = timeToMinutes(openingTime.toISOString().slice(11, 16));
  const close = timeToMinutes(closingTime.toISOString().slice(11, 16));
  const fmt = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  const slots: Array<{ startTime: string; endTime: string }> = [];
  for (let minute = open; minute < close; minute += 60) {
    slots.push({ startTime: fmt(minute), endTime: fmt(Math.min(minute + 60, close)) });
  }
  return slots;
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

    const [totalHistoricalBookings, matchingSlotBookings, cancellationCount, averageRows] = await Promise.all([
      demandPredictionRepository.totalHistoricalBookings(courtId),
      demandPredictionRepository.matchingSlotBookings(courtId, input.startTime, input.endTime),
      demandPredictionRepository.cancellationCount(courtId),
      demandPredictionRepository.averageComparableSlotBookings(courtId)
    ]);

    const mlPredictions = await mlPredictSlots({
      courtId,
      sportType: court.category.slug,
      totalHistoricalBookings,
      slots: [{ date: input.date, startTime: input.startTime }]
    });
    const mlResult = mlPredictions.get(slotKey(input.date, input.startTime));
    const modelVersion = mlResult ? ML_MODEL_VERSION : RULE_BASED_MODEL_VERSION;
    const result =
      mlResult ??
      calculateDemandScore({
        totalHistoricalBookings,
        matchingSlotBookings,
        averageBookingsPerComparableSlot: averageRows[0]?.average ?? 0,
        isWeekend: dayTypeFor(input.date) === "WEEKEND",
        isPeakHour: isPeakHour(input.startTime),
        cancellationCount,
        minHistory: RULE_BASED_MIN_HISTORY
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
   * Bulk demand-resolution for a whole week. Fetches every aggregate once
   * (plus a single ML batch call when enabled); the caller then scores every
   * slot in memory with `resolveSlotDemand`. This replaces the previous
   * per-slot path which executed ~6 queries + 1 insert per slot (≈ 700+ DB
   * hits per request) and choked the Supabase pooler.
   */
  async predictForWeek(input: { courtId: string; weekStart: string; weekEnd: string; slots: SlotInput[] }) {
    const court = await demandPredictionRepository.court(input.courtId);
    if (!court) throw new NotFoundError("San khong ton tai hoac chua duoc duyet");
    return buildDemandBundle(court, input.slots);
  },

  async partnerForecast(userId: string, courtId: string, date: string) {
    const profile = await partnerProfile(userId);
    const court = await demandPredictionRepository.partnerCourtWithCategory(courtId, profile.id);
    if (!court) throw new ForbiddenError("Chi duoc xem du doan cho san cua ban");

    const slots = hourlySlots(court.openingTime, court.closingTime);
    const bundle = await buildDemandBundle(court, slots.map((slot) => ({ date, startTime: slot.startTime })));

    return {
      courtId,
      date,
      totalHistoricalBookings: bundle.totalHistoricalBookings,
      ruleBasedMinHistory: RULE_BASED_MIN_HISTORY,
      mlMinHistory: env.ML_MIN_HISTORY,
      mlConfigured: Boolean(env.ML_SERVICE_URL),
      slots: slots.map((slot) => {
        const { result, modelVersion } = resolveSlotDemand(bundle, date, slot.startTime, slot.endTime);
        return {
          startTime: slot.startTime,
          endTime: slot.endTime,
          status: result.status,
          predictionLevel: result.predictionLevel,
          predictedDemandScore: result.predictedDemandScore,
          predictedOccupancyRate: result.predictedOccupancyRate,
          confidenceScore: result.confidenceScore,
          modelVersion: result.status === "GENERATED" ? modelVersion : null
        };
      })
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
    return {
      courtId,
      totalHistoricalBookings,
      status: totalHistoricalBookings >= RULE_BASED_MIN_HISTORY ? "READY" : "INSUFFICIENT_DATA",
      ruleBasedMinHistory: RULE_BASED_MIN_HISTORY,
      mlMinHistory: env.ML_MIN_HISTORY,
      mlReady: Boolean(env.ML_SERVICE_URL) && totalHistoricalBookings >= env.ML_MIN_HISTORY
    };
  },

  async peakHours(userId: string) {
    const profile = await partnerProfile(userId);
    const rows = await demandPredictionRepository.partnerPeakHours(profile.id);
    return rows.map((row) => ({ courtId: row.courtId, courtName: row.courtName, hour: row.hour, bookingCount: Number(row.bookingCount) }));
  }
};
