-- Admin notification campaigns sent to accounts the admin picks one by one (target_type 'USERS'), and to all
-- court staff (target_role 'RECIPIENT', which the role check left out, so "Tất cả nhân viên sân" failed).
--   * 'USERS' carries no role, account or partner: the picked ids are the notifications' user_id rows and are
--     kept in the campaign's metadata_json.targetUserIds (a recall deletes the notifications).
--   * Only widens the three checks; existing rows already satisfy them. No data changes.
-- Single statement, so it applies whole or not at all; safe to run more than once.
ALTER TABLE public.notification_campaigns
  DROP CONSTRAINT IF EXISTS notification_campaigns_target_type_check,
  DROP CONSTRAINT IF EXISTS notification_campaigns_target_role_check,
  DROP CONSTRAINT IF EXISTS notification_campaign_target_check,
  ADD CONSTRAINT notification_campaigns_target_type_check
    CHECK (target_type IN ('ALL', 'ROLE', 'USER', 'PARTNER', 'USERS')),
  ADD CONSTRAINT notification_campaigns_target_role_check
    CHECK (target_role IS NULL OR target_role IN ('USER', 'PARTNER', 'RECIPIENT', 'ADMIN')),
  ADD CONSTRAINT notification_campaign_target_check CHECK (
    (target_type = 'ALL' AND target_role IS NULL AND target_user_id IS NULL AND target_partner_id IS NULL)
    OR (target_type = 'ROLE' AND target_role IS NOT NULL AND target_user_id IS NULL AND target_partner_id IS NULL)
    OR (target_type = 'USER' AND target_user_id IS NOT NULL AND target_role IS NULL AND target_partner_id IS NULL)
    OR (target_type = 'PARTNER' AND target_partner_id IS NOT NULL AND target_role IS NULL AND target_user_id IS NULL)
    OR (target_type = 'USERS' AND target_role IS NULL AND target_user_id IS NULL AND target_partner_id IS NULL)
  );
