-- One-off repair (2026-11-03) of courts.court_count, which must equal the court's number of sub-courts (court_surfaces).
-- Until 24/10 the public court detail (court.repository) inserted "missing" sub-courts from a GET request without
-- updating court_count, and seed scripts set court_count without creating as many sub-courts: 37 of 43 courts disagreed
-- (c0043 "Sân Bóng Rổ Hoàng La": court_count 1, 3 sub-courts).
-- Until 03/11 partnerRepository.ensureCourtSurfaces also padded a court with "Sân NN" sub-courts up to court_count when
-- the partner opened it, so a count above the real sub-courts created sub-courts nobody declared (removed the same day).
-- Applied to Supabase on 2026-11-03. The admin notification trigger ignores court_count changes. Courts with no sub-court are left alone (court_count > 0).
-- Safe to run more than once: a second run finds nothing to change.
BEGIN;

UPDATE courts c
SET court_count = s.total
FROM (SELECT court_id, count(*)::int AS total FROM court_surfaces GROUP BY court_id) s
WHERE s.court_id = c.id
  AND c.court_count <> s.total;

COMMIT;
