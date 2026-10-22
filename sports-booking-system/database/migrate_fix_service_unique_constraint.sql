-- Migration: correct the services uniqueness rule.
--
-- A prior migration (migrate_add_service_partner_name_unique.sql) added a unique constraint on
-- (partner_id, name). That was wrong: the live, correct per-court seeding path
-- (`ensureCourtServicesSeededInDb` in backend/src/modules/services/service.repository.ts)
-- intentionally creates ONE SEPARATE `services` row per (court_id, name) — each court a partner
-- owns has its own independent stock/inventory row for the same product name. The
-- (partner_id, name) constraint blocked that, silently failing 17/22 inserts the first time it
-- was exercised.
--
-- `court_id` is a raw-SQL column (added ad-hoc by service.repository.ts, not modeled in
-- prisma/schema.prisma), so this constraint is applied via SQL only, same as that column.
-- Postgres unique constraints treat NULL as distinct from other NULLs, so rows with
-- court_id IS NULL (detached/legacy rows) are unaffected.

alter table services
  drop constraint if exists services_partner_id_name_key;

alter table services
  add constraint services_court_id_name_key unique (court_id, name);
