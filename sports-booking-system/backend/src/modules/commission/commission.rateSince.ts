/** A change of a commission rate in the audit log: when, and the admin who made it. */
export type RateChange = { at: Date; changedBy: string | null };

/** Why a partner's rate holds since that day: its own rate set or removed, the default changed, or it just joined. */
export type RateSinceReason = "OVERRIDE_SET" | "OVERRIDE_REMOVED" | "DEFAULT_CHANGED" | "JOINED";

export const RATE_SINCE_REASON_TEXT: Record<RateSinceReason, string> = {
  OVERRIDE_SET: "Đặt tỷ lệ riêng",
  OVERRIDE_REMOVED: "Bỏ tỷ lệ riêng, về mặc định",
  DEFAULT_CHANGED: "Đổi tỷ lệ mặc định",
  JOINED: "Từ khi tham gia"
};

/**
 * Since when a partner's current rate applies: the latest of the day it joined, the last change of its own rate
 * (setting one, or removing it to fall back on the default), and, for a partner on the default, the last change of
 * the default. Only changes that moved a rate count (the repository skips saves of the same value).
 */
export function partnerRateSince(input: {
  overrideRate: number | null;
  joinedAt: Date;
  partnerChange: RateChange | null;
  defaultChange: RateChange | null;
}): RateChange & { reason: RateSinceReason } {
  const candidates: Array<RateChange & { reason: RateSinceReason }> = [{ at: input.joinedAt, changedBy: null, reason: "JOINED" }];
  if (input.partnerChange) {
    candidates.push({ ...input.partnerChange, reason: input.overrideRate === null ? "OVERRIDE_REMOVED" : "OVERRIDE_SET" });
  }
  // A partner with its own rate does not follow the default, so changing the default changed nothing for it.
  if (input.overrideRate === null && input.defaultChange) candidates.push({ ...input.defaultChange, reason: "DEFAULT_CHANGED" });
  return candidates.reduce((latest, candidate) => (candidate.at.getTime() >= latest.at.getTime() ? candidate : latest));
}
