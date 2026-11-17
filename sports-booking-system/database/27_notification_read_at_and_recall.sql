-- When a recipient read each notification (set by "mark read" and "mark all read"), so the admin can see who read an
-- announcement and when. Notifications read before this migration keep read_at null.
-- An admin can recall a campaign sent by mistake: its notifications are deleted from every inbox and the campaign
-- stays in the history marked recalled, with who did it and why.
-- Additive only; safe to run more than once. Run `npx prisma generate` in backend afterwards.
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS read_at timestamptz(6);

ALTER TABLE notification_campaigns
  ADD COLUMN IF NOT EXISTS recalled_at timestamptz(6),
  ADD COLUMN IF NOT EXISTS recalled_by varchar(20),
  ADD COLUMN IF NOT EXISTS recall_reason text;
