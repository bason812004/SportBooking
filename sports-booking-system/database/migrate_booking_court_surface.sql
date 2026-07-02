-- Gan booking voi san con de van hanh dung tung san thuc te.
-- Chay file nay tren database hien co sau khi da co bang court_surfaces.

alter table bookings
  add column if not exists court_surface_id varchar(20) references court_surfaces(id);

alter table booking_slots
  add column if not exists court_surface_id varchar(20) references court_surfaces(id);

create index if not exists idx_bookings_court_surface_id
  on bookings(court_surface_id);

create index if not exists idx_bookings_surface_schedule_conflict
  on bookings(court_surface_id, booking_date, start_time, end_time, booking_status);

create index if not exists idx_booking_slots_surface_schedule
  on booking_slots(court_surface_id, booking_date, start_time, end_time);

-- Du lieu cu chua co court_surface_id duoc giu null de backend xu ly nhu booking legacy cua ca cum san.
-- Neu muon gan tam booking cu vao san con dau tien, co the can nhac cau lenh ben duoi sau khi kiem tra trung lich:
--
-- update bookings b
-- set court_surface_id = (
--   select cs.id
--   from court_surfaces cs
--   where cs.court_id = b.court_id and cs.status = 'ACTIVE'
--   order by cs.sort_order, cs.code
--   limit 1
-- )
-- where b.court_surface_id is null;
