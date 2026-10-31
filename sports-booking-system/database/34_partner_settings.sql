-- Partner settings (2026-10-29). Safe to run more than once; no data is changed.

-- When the bank account withdrawals go to was last set or changed. For 24 hours after that no withdrawal can be
-- requested (the real owner gets the notice and email first), and admins see recent changes on withdrawal requests.
-- Changing it no longer sends the partner profile back to admin review.
alter table partner_profiles add column if not exists bank_account_changed_at timestamptz;
