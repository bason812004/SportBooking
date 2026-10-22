import { calculateDemandScore, type DemandScoreResult } from "../../shared/utils/businessRules.js";
import { dayTypeFor, timeToMinutes } from "../../shared/utils/time.js";

export const RULE_BASED_MODEL_VERSION = "rule-based-v1";
export const ML_MODEL_VERSION = "ml-random-forest-v1";
export const RULE_BASED_MIN_HISTORY = 20;

/**
 * Feature mapping between the backend and the ML service. Must stay in sync with
 * `ml/scripts/feature_engineering.py`: the model was trained on one row per
 * (court, day_of_week, hour) "slot pattern" with rolling aggregates taken only from
 * weeks before the predicted week, and day_of_week follows pandas (Mon=0 .. Sun=6).
 */

export type SlotPatternStats = {
  dow: number;
  hour: number;
  priorTotal: number;
  priorAvg: number;
  priorCancel: number;
  priorVoucher: number;
  priorPrice: number;
};

export type MlRequestRow = {
  hour_of_day: number;
  day_of_week: number;
  is_weekend: boolean;
  sport_type: string;
  prior_total_bookings: number;
  prior_avg_comparable_bookings: number;
  prior_cancellation_count: number;
  prior_voucher_usage_count: number;
  prior_average_price: number;
};

export type MlPredictResponse = {
  predicted_demand_score: number;
  predicted_occupancy_rate: number;
  prediction_level: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  confidence_score: number;
};

/** Monday=0 .. Sunday=6, matching pandas `dt.dayofweek` and Postgres `isodow - 1`. */
export function isoDayOfWeek(date: string) {
  return (new Date(`${date}T00:00:00.000Z`).getUTCDay() + 6) % 7;
}

/** Monday of the week containing `date` (YYYY-MM-DD). */
export function weekStartOf(date: string) {
  const dt = new Date(`${date}T00:00:00.000Z`);
  dt.setUTCDate(dt.getUTCDate() - isoDayOfWeek(date));
  return dt.toISOString().slice(0, 10);
}

/**
 * Monday before which booking history is used as features for `date`: the predicted
 * week's Monday, but never later than next Monday -- weeks that have not happened
 * yet would otherwise count as empty and drag the slot's weekly booking rate down.
 */
export function historyCutoff(date: string, today: string) {
  const targetWeek = weekStartOf(date);
  const next = new Date(`${weekStartOf(today)}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 7);
  const nextWeek = next.toISOString().slice(0, 10);
  return targetWeek < nextWeek ? targetWeek : nextWeek;
}

export function hourOfDay(startTime: string) {
  return Math.floor(timeToMinutes(startTime) / 60);
}

export function isPeakHour(startTime: string) {
  const minutes = timeToMinutes(startTime);
  return minutes >= timeToMinutes("17:00") && minutes < timeToMinutes("21:00");
}

export function slotPatternKey(dow: number, hour: number) {
  return `${dow}|${hour}`;
}

export function slotKey(date: string, startTime: string) {
  return `${date}|${startTime}`;
}

/** Returns null when the slot pattern has no history: the model never saw such rows in training. */
export function toMlRequestRow(input: {
  date: string;
  startTime: string;
  sportType: string;
  statsByPattern: Map<string, SlotPatternStats>;
}): MlRequestRow | null {
  const dow = isoDayOfWeek(input.date);
  const hour = hourOfDay(input.startTime);
  const stats = input.statsByPattern.get(slotPatternKey(dow, hour));
  if (!stats) return null;

  return {
    hour_of_day: hour,
    day_of_week: dow,
    is_weekend: dow >= 5,
    sport_type: input.sportType,
    prior_total_bookings: stats.priorTotal,
    prior_avg_comparable_bookings: stats.priorAvg,
    prior_cancellation_count: stats.priorCancel,
    prior_voucher_usage_count: stats.priorVoucher,
    prior_average_price: stats.priorPrice
  };
}

export function fromMlResponse(body: MlPredictResponse): DemandScoreResult {
  return {
    status: "GENERATED",
    predictedDemandScore: body.predicted_demand_score,
    predictedOccupancyRate: body.predicted_occupancy_rate,
    predictionLevel: body.prediction_level,
    confidenceScore: body.confidence_score
  };
}

/** Per-court aggregates fetched once, then used to score many slots in memory. */
export type DemandHistoryBundle = {
  totalHistoricalBookings: number;
  cancellationCount: number;
  averageBookingsPerComparableSlot: number;
  /** Keyed by `${startTime}-${endTime}`. */
  matchingCountsByWindow: Record<string, number>;
  /** Keyed by slotKey(date, startTime); only slots the ML service scored. */
  mlPredictions: Record<string, DemandScoreResult>;
};

/** ML result when the service scored this slot, otherwise the rule-based score. */
export function resolveSlotDemand(bundle: DemandHistoryBundle, date: string, startTime: string, endTime: string) {
  const mlResult = bundle.mlPredictions[slotKey(date, startTime)];
  if (mlResult) return { result: mlResult, modelVersion: ML_MODEL_VERSION };

  const result = calculateDemandScore({
    totalHistoricalBookings: bundle.totalHistoricalBookings,
    matchingSlotBookings: bundle.matchingCountsByWindow[`${startTime}-${endTime}`] ?? 0,
    averageBookingsPerComparableSlot: bundle.averageBookingsPerComparableSlot,
    isWeekend: dayTypeFor(date) === "WEEKEND",
    isPeakHour: isPeakHour(startTime),
    cancellationCount: bundle.cancellationCount,
    minHistory: RULE_BASED_MIN_HISTORY
  });
  return { result, modelVersion: RULE_BASED_MODEL_VERSION };
}
