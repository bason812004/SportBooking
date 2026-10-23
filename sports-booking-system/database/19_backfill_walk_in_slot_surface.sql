-- Counter (walk-in) bookings used to create booking_slots rows without
-- court_surface_id. The online conflict check and the public weekly schedule
-- (booking.repository.ts findConflictsInTransaction, weeklySchedule.repository.ts
-- bookingSlots) read a NULL court_surface_id as "whole court", so one walk-in on
-- surface A also blocked surfaces B, C, ... for online customers.
--
-- A booking that has court_surface_id is on that surface, so its NULL slots belong
-- to it as well. Slots of bookings without a surface are left untouched.
-- Safe to run more than once.
UPDATE booking_slots bs
SET court_surface_id = b.court_surface_id
FROM bookings b
WHERE bs.booking_id = b.id
  AND bs.court_surface_id IS NULL
  AND b.court_surface_id IS NOT NULL;
