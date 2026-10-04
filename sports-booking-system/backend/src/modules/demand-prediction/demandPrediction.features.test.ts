import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fromMlResponse,
  historyCutoff,
  isoDayOfWeek,
  ML_MODEL_VERSION,
  resolveSlotDemand,
  RULE_BASED_MODEL_VERSION,
  slotKey,
  slotPatternKey,
  toMlRequestRow,
  weekStartOf,
  type DemandHistoryBundle,
  type SlotPatternStats
} from "./demandPrediction.features.js";

const stats: SlotPatternStats = {
  dow: 5,
  hour: 18,
  priorTotal: 9,
  priorAvg: 1.5,
  priorCancel: 1,
  priorVoucher: 2,
  priorPrice: 120000
};

describe("demand prediction ML features", () => {
  it("uses Monday=0 .. Sunday=6 like pandas dayofweek", () => {
    assert.equal(isoDayOfWeek("2026-09-28"), 0); // Monday
    assert.equal(isoDayOfWeek("2026-10-03"), 5); // Saturday
    assert.equal(isoDayOfWeek("2026-10-04"), 6); // Sunday
  });

  it("builds the request row from the matching slot-pattern history", () => {
    const row = toMlRequestRow({
      date: "2026-10-03",
      startTime: "18:00",
      sportType: "badminton",
      statsByPattern: new Map([[slotPatternKey(5, 18), stats]])
    });
    assert.deepEqual(row, {
      hour_of_day: 18,
      day_of_week: 5,
      is_weekend: true,
      sport_type: "badminton",
      prior_total_bookings: 9,
      prior_avg_comparable_bookings: 1.5,
      prior_cancellation_count: 1,
      prior_voucher_usage_count: 2,
      prior_average_price: 120000
    });
  });

  it("returns null when the slot pattern has no history", () => {
    const row = toMlRequestRow({
      date: "2026-10-04",
      startTime: "18:00",
      sportType: "badminton",
      statsByPattern: new Map([[slotPatternKey(5, 18), stats]])
    });
    assert.equal(row, null);
  });

  it("finds the Monday of the week", () => {
    assert.equal(weekStartOf("2026-10-01"), "2026-09-28");
    assert.equal(weekStartOf("2026-10-04"), "2026-09-28");
    assert.equal(weekStartOf("2026-09-28"), "2026-09-28");
  });

  it("uses history up to the predicted week, capped at next week", () => {
    // today = Thursday 2026-10-01 (week of 2026-09-28)
    assert.equal(historyCutoff("2026-10-03", "2026-10-01"), "2026-09-28"); // this week
    assert.equal(historyCutoff("2026-10-07", "2026-10-01"), "2026-10-05"); // next week
    assert.equal(historyCutoff("2026-11-20", "2026-10-01"), "2026-10-05"); // far future: no empty future weeks
  });

  it("prefers the ML prediction and falls back to rule-based for other slots", () => {
    const mlResult = fromMlResponse({
      predicted_demand_score: 40,
      predicted_occupancy_rate: 0.4,
      prediction_level: "MEDIUM",
      confidence_score: 0.85
    });
    const bundle: DemandHistoryBundle = {
      totalHistoricalBookings: 60,
      cancellationCount: 0,
      averageBookingsPerComparableSlot: 1,
      matchingCountsByWindow: { "18:00-19:00": 2 },
      mlPredictions: { [slotKey("2026-10-03", "18:00")]: mlResult }
    };

    const ml = resolveSlotDemand(bundle, "2026-10-03", "18:00", "19:00");
    assert.equal(ml.modelVersion, ML_MODEL_VERSION);
    assert.equal(ml.result, mlResult);

    const ruleBased = resolveSlotDemand(bundle, "2026-10-04", "18:00", "19:00");
    assert.equal(ruleBased.modelVersion, RULE_BASED_MODEL_VERSION);
    assert.equal(ruleBased.result.status, "GENERATED");
    assert.equal(ruleBased.result.predictionLevel, "VERY_HIGH");
  });

  it("reports insufficient data below the rule-based history threshold", () => {
    const { result } = resolveSlotDemand(
      { totalHistoricalBookings: 5, cancellationCount: 0, averageBookingsPerComparableSlot: 0, matchingCountsByWindow: {}, mlPredictions: {} },
      "2026-10-03",
      "18:00",
      "19:00"
    );
    assert.equal(result.status, "INSUFFICIENT_DATA");
  });

  it("maps the ML response to a generated demand result", () => {
    const result = fromMlResponse({
      predicted_demand_score: 72.5,
      predicted_occupancy_rate: 0.73,
      prediction_level: "HIGH",
      confidence_score: 0.85
    });
    assert.deepEqual(result, {
      status: "GENERATED",
      predictedDemandScore: 72.5,
      predictedOccupancyRate: 0.73,
      predictionLevel: "HIGH",
      confidenceScore: 0.85
    });
  });
});
