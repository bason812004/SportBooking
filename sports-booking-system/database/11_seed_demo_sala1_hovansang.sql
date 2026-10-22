-- Seed ~10 don dat san demo cho "San bong Sala 1", khach hang Ho Van Sang (0974678307)
-- Gom 2 don gop nhieu khung gio / nhieu san (booking_orders) de demo tinh nang gop don.
-- Idempotent: chay lai se tu xoa ban ghi demo cu (danh dau qua note) truoc khi tao lai.
-- Chay trong Supabase Dashboard > SQL Editor.

begin;

delete from bookings where note = 'DEMO_SALA1_20260731';
delete from booking_orders where note = 'DEMO_SALA1_20260731';

do $$
declare
  v_user_id varchar(20);
  v_court_id varchar(20);
  v_surface_1 varchar(20);
  v_surface_2 varchar(20);
  v_order_a varchar(20);
  v_order_b varchar(20);
begin
  select id into v_court_id from courts where id = 'c0001';
  if v_court_id is null then
    select id into v_court_id from courts where name ilike '%Sala 1%' order by id limit 1;
  end if;
  if v_court_id is null then
    raise exception 'Khong tim thay san "San bong Sala 1" (id c0001 hoac ten chua "Sala 1")';
  end if;

  select id into v_surface_1 from court_surfaces where court_id = v_court_id order by sort_order limit 1;
  select id into v_surface_2 from court_surfaces where court_id = v_court_id and id <> v_surface_1 order by sort_order limit 1;
  v_surface_2 := coalesce(v_surface_2, v_surface_1);

  select id into v_user_id from users where phone = '0974678307' limit 1;
  if v_user_id is null then
    insert into users (full_name, email, phone, role, email_verified)
    values ('Ho Van Sang', 'hovansang.demo@sportsbooking.local', '0974678307', 'USER', true)
    returning id into v_user_id;
  end if;

  -- Don gop A: 3 khung gio, cung 1 san con
  insert into booking_orders (user_id, court_id, subtotal, total_amount, payment_type, status, note)
  values (v_user_id, v_court_id, 660000, 660000, 'CASH', 'CONFIRMED', 'DEMO_SALA1_20260731')
  returning id into v_order_a;

  insert into bookings (
    booking_code, user_id, court_id, court_surface_id, booking_order_id,
    booking_date, start_time, end_time, total_price, base_price, subtotal,
    payment_method, payment_status, booking_status, note
  ) values
    ('DEMO260731-A1', v_user_id, v_court_id, v_surface_1, v_order_a, '2026-07-31', '09:00', '10:00', 220000, 220000, 220000, 'CASH', 'PAID', 'CONFIRMED', 'DEMO_SALA1_20260731'),
    ('DEMO260731-A2', v_user_id, v_court_id, v_surface_1, v_order_a, '2026-07-31', '10:00', '11:00', 220000, 220000, 220000, 'CASH', 'PAID', 'CONFIRMED', 'DEMO_SALA1_20260731'),
    ('DEMO260731-A3', v_user_id, v_court_id, v_surface_1, v_order_a, '2026-07-31', '15:00', '16:00', 220000, 220000, 220000, 'CASH', 'PAID', 'CONFIRMED', 'DEMO_SALA1_20260731');

  -- Don gop B: 2 khung gio, 2 san con khac nhau, cung gio
  insert into booking_orders (user_id, court_id, subtotal, total_amount, payment_type, status, note)
  values (v_user_id, v_court_id, 440000, 440000, 'CASH', 'CONFIRMED', 'DEMO_SALA1_20260731')
  returning id into v_order_b;

  insert into bookings (
    booking_code, user_id, court_id, court_surface_id, booking_order_id,
    booking_date, start_time, end_time, total_price, base_price, subtotal,
    payment_method, payment_status, booking_status, note
  ) values
    ('DEMO260731-B1', v_user_id, v_court_id, v_surface_1, v_order_b, '2026-07-31', '16:00', '17:00', 220000, 220000, 220000, 'CASH', 'PAID', 'CONFIRMED', 'DEMO_SALA1_20260731'),
    ('DEMO260731-B2', v_user_id, v_court_id, v_surface_2, v_order_b, '2026-07-31', '16:00', '17:00', 220000, 220000, 220000, 'CASH', 'PAID', 'CONFIRMED', 'DEMO_SALA1_20260731');

  -- 8 don le (1 khung gio / don), da dang trang thai de demo bang cho thuc te
  insert into bookings (
    booking_code, user_id, court_id, court_surface_id,
    booking_date, start_time, end_time, total_price, base_price, subtotal, refund_amount,
    payment_method, payment_status, booking_status, note
  ) values
    ('DEMO260731-01', v_user_id, v_court_id, v_surface_1, '2026-07-31', '06:00', '07:00', 220000, 220000, 220000, 0,      'BANK_TRANSFER', 'UNPAID',             'PENDING',   'DEMO_SALA1_20260731'),
    ('DEMO260731-02', v_user_id, v_court_id, v_surface_1, '2026-07-31', '08:00', '09:00', 220000, 220000, 220000, 0,      'CASH',          'PAID',               'CONFIRMED', 'DEMO_SALA1_20260731'),
    ('DEMO260731-03', v_user_id, v_court_id, v_surface_1, '2026-07-31', '12:00', '13:00', 220000, 220000, 220000, 0,      'E_WALLET',      'PAID',               'CONFIRMED', 'DEMO_SALA1_20260731'),
    ('DEMO260731-04', v_user_id, v_court_id, v_surface_1, '2026-07-31', '14:00', '15:00', 220000, 220000, 220000, 0,      'CASH',          'PAID',               'COMPLETED', 'DEMO_SALA1_20260731'),
    ('DEMO260731-05', v_user_id, v_court_id, v_surface_1, '2026-07-31', '20:00', '21:00', 220000, 220000, 220000, 220000, 'BANK_TRANSFER', 'REFUNDED',           'CANCELLED', 'DEMO_SALA1_20260731'),
    ('DEMO260731-06', v_user_id, v_court_id, v_surface_2, '2026-07-31', '07:00', '08:00', 220000, 220000, 220000, 0,      'BANK_TRANSFER', 'UNPAID',             'PENDING',   'DEMO_SALA1_20260731'),
    ('DEMO260731-07', v_user_id, v_court_id, v_surface_2, '2026-07-31', '11:00', '12:00', 220000, 220000, 220000, 110000, 'CASH',          'PARTIALLY_REFUNDED', 'NO_SHOW',   'DEMO_SALA1_20260731'),
    ('DEMO260731-08', v_user_id, v_court_id, v_surface_2, '2026-07-31', '19:00', '20:00', 220000, 220000, 220000, 0,      'CASH',          'PAID',               'CONFIRMED', 'DEMO_SALA1_20260731');

  raise notice 'Da tao 10 don demo (13 booking) cho san %, khach %', v_court_id, v_user_id;
end $$;

commit;

-- Kiem tra nhanh
select booking_code, court_surface_id, booking_order_id, booking_date, start_time, end_time, booking_status, payment_status, total_price
from bookings
where note = 'DEMO_SALA1_20260731'
order by booking_order_id nulls last, start_time;
