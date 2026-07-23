-- Migration: Enforce ACTIVE-only semantics for team_post_members.
-- The status column was added in migrate_team_chat_media_reactions.sql.
-- This migration:
--   1. Adds a CHECK constraint to keep status consistent.
--   2. Adds a partial unique index for ACTIVE rows to guarantee one ACTIVE row
--      per (post, user) even after historical LEFT/REMOVED rows exist.
--   3. Backfills the status column for legacy ACTIVE rows that pre-date the column.
--
-- Safe to run on a populated database: every statement is idempotent.

update team_post_members
set status = 'ACTIVE'
where status is null or status not in ('ACTIVE', 'LEFT', 'REMOVED');

alter table team_post_members
  drop constraint if exists team_post_members_status_check;
alter table team_post_members
  add constraint team_post_members_status_check
  check (status in ('ACTIVE', 'LEFT', 'REMOVED'));

create unique index if not exists ux_team_post_members_active
  on team_post_members (post_id, user_id)
  where status = 'ACTIVE';

create index if not exists idx_team_post_members_active_lookup
  on team_post_members (post_id, user_id)
  where status = 'ACTIVE';
