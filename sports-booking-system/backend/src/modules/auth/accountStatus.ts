import { authRepository } from "./auth.repository.js";

// How long a looked-up status is trusted. Locking or unlocking on this server clears it at once
// (forgetAccountStatus); another server instance, if any, picks the change up within this window.
const STATUS_TTL_MS = 30_000;
const PRUNE_ABOVE = 5_000;

type AccountState = { active: boolean; sessionsRevokedAt: number | null };

const cache = new Map<string, { state: Promise<AccountState>; expiresAt: number }>();

/**
 * Access tokens live for days, so an admin lock, a deleted account or revoked sessions have to be checked per request,
 * not only at login and refresh. Concurrent requests share one lookup.
 */
function accountState(userId: string): Promise<AccountState> {
  const now = Date.now();
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > now) return cached.state;

  if (cache.size > PRUNE_ABOVE) {
    for (const [id, entry] of cache) if (entry.expiresAt <= now) cache.delete(id);
  }
  const state = authRepository.accountStatus(userId).then((row) => ({
    active: row?.status === "ACTIVE",
    sessionsRevokedAt: row?.sessionsRevokedAt ? new Date(row.sessionsRevokedAt).getTime() : null
  }));
  cache.set(userId, { state, expiresAt: now + STATUS_TTL_MS });
  // A failed lookup must not be remembered for the whole window.
  state.catch(() => {
    if (cache.get(userId)?.state === state) cache.delete(userId);
  });
  return state;
}

/** Whether the account may still use the API. */
export function isAccountActive(userId: string): Promise<boolean> {
  return accountState(userId).then((state) => state.active);
}

/**
 * Why a token of this account is refused, or null when it is accepted: the account is locked, or the token was issued
 * (JWT `iat`, in seconds) before the account's sessions were revoked, as when a partner changes a staff password.
 */
export async function sessionRefusal(userId: string, issuedAt?: number): Promise<"LOCKED" | "REVOKED" | null> {
  const state = await accountState(userId);
  if (!state.active) return "LOCKED";
  if (state.sessionsRevokedAt != null && (issuedAt ?? 0) < Math.floor(state.sessionsRevokedAt / 1000)) return "REVOKED";
  return null;
}

/** Call after changing an account's status or revoking its sessions so its next request sees the change. */
export function forgetAccountStatus(userId: string) {
  cache.delete(userId);
}
