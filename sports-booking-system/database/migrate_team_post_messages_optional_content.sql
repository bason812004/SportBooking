-- Migration: Make team_post_messages.content optional so media-only messages
-- (IMAGE / VIDEO attachments) can be stored without a text body. Existing rows
-- with non-null content are preserved. Re-runs are safe.
--
-- Run once on the Supabase database. After running, no schema changes are
-- required for Prisma because content is still typed as text (nullable).

alter table team_post_messages
  alter column content drop not null;

-- Backfill safety: legacy rows still have non-null content; nothing to do here
-- but keep the alter explicit so a successful run is observable in the migration log.
select 1;
