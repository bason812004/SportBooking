-- Migration: unique constraint on services(partner_id, name) to stop seed scripts from
-- silently inserting duplicate services (ON CONFLICT DO NOTHING had no target to match
-- against before this, so it never actually fired). Run AFTER deduping existing rows
-- (see backend/src/scripts/merge_duplicate_services.ts) — this fails if duplicates remain.

alter table services
  add constraint services_partner_id_name_key unique (partner_id, name);
