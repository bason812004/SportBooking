// DEPRECATED — do not run.
//
// This script used to bulk-insert a shared sample-service catalog per partner and then
// (buggily) reassign court_id across the whole `services` table. That corrupted court_id
// system-wide — see `fix_court_id_mismatch.ts` for the one-off repair this required.
//
// Per-court service catalogs are seeded correctly and safely by `ensureCourtServicesSeededInDb`
// in `src/modules/services/service.repository.ts`, which runs lazily the first time a court's
// service list is requested (`GET /services/courts/:courtId`) and only inserts when that court
// currently has zero of its own services. Nothing needs to call this script anymore.
console.log(
  "seed_all_services.ts is deprecated and does nothing. Court service catalogs self-seed on first request " +
    "via ensureCourtServicesSeededInDb (src/modules/services/service.repository.ts)."
);
