// Wrong current-password answers per account, for the checks a signed-in user passes before a sensitive change
// (a new password, the bank account withdrawals go to). Kept in memory: one server instance; a restart forgets them.
export const MAX_PASSWORD_FAILURES = 5;
export const PASSWORD_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const PRUNE_ABOVE = 5_000;

const failures = new Map<string, number[]>();

function recent(userId: string, now: number) {
  const kept = (failures.get(userId) ?? []).filter((at) => now - at < PASSWORD_FAILURE_WINDOW_MS);
  if (kept.length) failures.set(userId, kept);
  else failures.delete(userId);
  return kept;
}

/** How long (ms) the account must wait before trying again; 0 when it may try now. */
export function passwordRetryAfter(userId: string, now = Date.now()) {
  const kept = recent(userId, now);
  if (kept.length < MAX_PASSWORD_FAILURES) return 0;
  return kept[kept.length - MAX_PASSWORD_FAILURES] + PASSWORD_FAILURE_WINDOW_MS - now;
}

/** Records a wrong answer; returns how many tries are left in the window. */
export function recordPasswordFailure(userId: string, now = Date.now()) {
  if (failures.size > PRUNE_ABOVE) {
    for (const id of failures.keys()) recent(id, now);
  }
  const kept = [...recent(userId, now), now];
  failures.set(userId, kept);
  return Math.max(0, MAX_PASSWORD_FAILURES - kept.length);
}

export function clearPasswordFailures(userId: string) {
  failures.delete(userId);
}
