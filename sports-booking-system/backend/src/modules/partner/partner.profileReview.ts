/**
 * Details an admin verified: changing one sends an approved partner back to review. Name, phone or avatar edits do not,
 * and neither does the bank account: that one is guarded by the password, a notice and a 24-hour wait before
 * withdrawals (BANK_CHANGE_COOLDOWN_MS), so it does not hold up court approvals.
 */
export const VERIFIED_PROFILE_FIELDS = ["businessName", "taxCode", "verificationDocumentUrl"] as const;
type VerifiedProfileField = (typeof VERIFIED_PROFILE_FIELDS)[number];

/**
 * Whether saving the profile puts it back in the admin review queue. A rejected partner saving the form is
 * resubmitting it, whatever changed; otherwise only a change to a verified detail does.
 */
export function needsReview(
  current: { approvalStatus: string } & Record<VerifiedProfileField, string | null>,
  next: Record<VerifiedProfileField, string | null>
) {
  if (current.approvalStatus === "REJECTED") return true;
  const normalized = (value: string | null) => value?.trim() || null;
  return VERIFIED_PROFILE_FIELDS.some((field) => normalized(next[field]) !== normalized(current[field]));
}
