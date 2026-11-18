import type { CourtReviewStatsRow, ReviewDayRow } from "./review.repository.js";

const DAY_MS = 24 * 60 * 60 * 1000;
/** A trend over at most this many days is drawn day by day; a longer one month by month. */
export const TREND_DAY_LIMIT = 62;

const average = (ratingSum: number, count: number) => (count ? Math.round((ratingSum / count) * 10) / 10 : 0);

/** Average and spread of a set of reviews; hidden ones are counted apart and never weigh on the average. */
export function summarizeRatings(groups: Array<{ rating: number; displayStatus: string; _count: { _all: number } }>) {
  const visible = groups.filter((group) => group.displayStatus === "VISIBLE");
  const count = (list: typeof groups) => list.reduce((sum, group) => sum + group._count._all, 0);
  const total = count(visible);
  const points = visible.reduce((sum, group) => sum + group.rating * group._count._all, 0);
  return {
    total,
    averageRating: total ? Math.round((points / total) * 10) / 10 : 0,
    hiddenCount: count(groups.filter((group) => group.displayStatus === "HIDDEN")),
    distribution: [5, 4, 3, 2, 1].map((rating) => ({ rating, count: count(visible.filter((group) => group.rating === rating)) }))
  };
}

/**
 * Visible reviews per day or per month from `fromDay` (the first review when there is no start) to `toDay`, all in
 * YYYY-MM-DD Vietnam days. Periods without a review count 0 and have no average.
 */
export function reviewTrend(days: ReviewDayRow[], fromDay: string | undefined, toDay: string) {
  const start = fromDay ?? days[0]?.day ?? toDay;
  const unit: "day" | "month" = (Date.parse(toDay) - Date.parse(start)) / DAY_MS + 1 <= TREND_DAY_LIMIT ? "day" : "month";
  const periodOf = (day: string) => (unit === "day" ? day : day.slice(0, 7));

  const totals = new Map<string, { count: number; ratingSum: number }>();
  for (const row of days) {
    const total = totals.get(periodOf(row.day)) ?? { count: 0, ratingSum: 0 };
    total.count += row.count;
    total.ratingSum += row.ratingSum;
    totals.set(periodOf(row.day), total);
  }

  const periods: string[] = [];
  if (unit === "day") {
    for (let time = Date.parse(start); time <= Date.parse(toDay); time += DAY_MS) periods.push(new Date(time).toISOString().slice(0, 10));
  } else {
    const cursor = new Date(`${start.slice(0, 7)}-01T00:00:00Z`);
    for (; cursor.toISOString().slice(0, 7) <= toDay.slice(0, 7); cursor.setUTCMonth(cursor.getUTCMonth() + 1)) {
      periods.push(cursor.toISOString().slice(0, 7));
    }
  }

  return {
    unit,
    points: periods.map((period) => {
      const total = totals.get(period);
      return { period, count: total?.count ?? 0, averageRating: total ? average(total.ratingSum, total.count) : null };
    })
  };
}

type RankedStats = { name: string; count: number; averageRating: number };

/** Lowest average first, so the courts customers like least lead; on a tie the one with more reviews first. */
function lowestRatedFirst<T extends RankedStats>(rows: T[]) {
  return rows.sort((left, right) => left.averageRating - right.averageRating || right.count - left.count || left.name.localeCompare(right.name, "vi"));
}

/** Courts with visible reviews, lowest rated first. A court whose reviews are all hidden has no average to rank. */
export function rankCourts(rows: CourtReviewStatsRow[]) {
  return lowestRatedFirst(
    rows
      .filter((row) => row.visibleCount > 0)
      .map((row) => ({
        id: row.id,
        name: row.name,
        partnerId: row.partnerId,
        partnerName: row.partnerName,
        count: row.visibleCount,
        averageRating: average(row.ratingSum, row.visibleCount),
        hiddenCount: row.hiddenCount,
        repliedCount: row.repliedCount,
        lowCount: row.lowCount
      }))
  );
}

/** The courts' figures added up per partner; the average weighs every review alike, not every court. */
export function rankPartners(rows: CourtReviewStatsRow[]) {
  const partners = new Map<string, { id: string; name: string; courtCount: number; count: number; ratingSum: number; hiddenCount: number; repliedCount: number; lowCount: number }>();
  for (const row of rows) {
    if (!row.partnerId) continue;
    const partner = partners.get(row.partnerId) ?? {
      id: row.partnerId,
      name: row.partnerName ?? row.partnerId,
      courtCount: 0,
      count: 0,
      ratingSum: 0,
      hiddenCount: 0,
      repliedCount: 0,
      lowCount: 0
    };
    if (row.visibleCount > 0) partner.courtCount += 1;
    partner.count += row.visibleCount;
    partner.ratingSum += row.ratingSum;
    partner.hiddenCount += row.hiddenCount;
    partner.repliedCount += row.repliedCount;
    partner.lowCount += row.lowCount;
    partners.set(row.partnerId, partner);
  }
  return lowestRatedFirst(
    [...partners.values()]
      .filter((partner) => partner.count > 0)
      .map(({ ratingSum, ...partner }) => ({ ...partner, averageRating: average(ratingSum, partner.count) }))
  );
}
