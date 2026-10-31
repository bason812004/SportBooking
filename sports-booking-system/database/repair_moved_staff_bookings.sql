-- One-off repair (2026-10-29) of bookings the staff booking list's old "orphan fixup" moved. On its first load after
-- each server start it reassigned every booking without a sub-court, of any partner, to court c0001 (San bong Sala 1)
-- and one of its sub-courts. 42 bookings made between 22/07 and 18/08 (played 22/07-30/08) were moved that way.
-- Their booking_slots still name the court they were booked on (one per booking), but their sub-court was
-- overwritten with c0001's as well, so the real sub-court is unknown: the booking goes back to its court with no
-- sub-court ("Chưa gán sân"), which, all of them being in the past, blocks nothing.
-- No settlement, review or payment points at a court; their booking orders already name the right court.
-- Safe to run more than once: a second run finds nothing to change.
BEGIN;

WITH booked_on AS (
  SELECT s.booking_id, min(s.court_id) AS court_id
  FROM booking_slots s
  JOIN bookings b ON b.id = s.booking_id
  WHERE s.court_id <> b.court_id
  GROUP BY s.booking_id
  HAVING count(DISTINCT s.court_id) = 1
)
UPDATE bookings b
SET court_id = o.court_id,
    court_surface_id = NULL,
    updated_at = now()
FROM booked_on o
WHERE b.id = o.booking_id;

-- A slot cannot be on another court's sub-court.
UPDATE booking_slots s
SET court_surface_id = NULL
WHERE s.court_surface_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM court_surfaces cs WHERE cs.id = s.court_surface_id AND cs.court_id = s.court_id);

COMMIT;
