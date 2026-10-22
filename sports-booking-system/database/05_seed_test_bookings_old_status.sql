-- Seed test bookings using the existing enum values only:
-- booking_status: PENDING, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW
-- payment_status: UNPAID, PAID, PARTIALLY_REFUNDED, REFUNDED
--
-- Run after you already have users and courts.
-- These rows are for testing GET /api/courts/:courtId/availability?date=2026-06-24.

begin;

alter table bookings
  add column if not exists base_price numeric(12, 2) not null default 0,
  add column if not exists dynamic_adjustment_amount numeric(12, 2) not null default 0,
  add column if not exists subtotal numeric(12, 2) not null default 0,
  add column if not exists voucher_discount_amount numeric(12, 2) not null default 0,
  add column if not exists deposit_amount numeric(12, 2) not null default 0,
  add column if not exists refund_amount numeric(12, 2) not null default 0,
  add column if not exists platform_retained_amount numeric(12, 2) not null default 0,
  add column if not exists note text;

do $$
declare
  v_user_1 varchar(20);
  v_user_2 varchar(20);
  v_user_3 varchar(20);
  v_court_1 varchar(20);
  v_court_2 varchar(20);
begin
  select id into v_user_1 from users where role = 'USER' order by id limit 1;
  select id into v_user_2 from users where role = 'USER' and id <> v_user_1 order by id limit 1;
  select id into v_user_3 from users where role = 'USER' and id not in (v_user_1, coalesce(v_user_2, '')) order by id limit 1;

  select c.id
  into v_court_1
  from courts c
  join court_categories cc on cc.id = c.category_id
  where c.approval_status = 'APPROVED'
    and c.active_status = 'ACTIVE'
    and cc.status = 'ACTIVE'
  order by c.id
  limit 1;

  select c.id
  into v_court_2
  from courts c
  join court_categories cc on cc.id = c.category_id
  where c.approval_status = 'APPROVED'
    and c.active_status = 'ACTIVE'
    and cc.status = 'ACTIVE'
    and c.id <> v_court_1
  order by c.id
  limit 1;

  if v_user_1 is null or v_court_1 is null then
    raise exception 'Need at least one USER and one APPROVED/ACTIVE court before seeding test bookings.';
  end if;

  v_user_2 := coalesce(v_user_2, v_user_1);
  v_user_3 := coalesce(v_user_3, v_user_1);
  v_court_2 := coalesce(v_court_2, v_court_1);

  insert into bookings (
    id,
    booking_code,
    user_id,
    court_id,
    booking_date,
    start_time,
    end_time,
    total_price,
    base_price,
    subtotal,
    voucher_discount_amount,
    deposit_amount,
    payment_method,
    payment_status,
    booking_status,
    note,
    created_at,
    updated_at
  ) values
    (
      'bt9001',
      'TEST-20260624-01',
      v_user_1,
      v_court_1,
      '2026-06-24',
      '18:00',
      '19:00',
      180000,
      180000,
      180000,
      0,
      90000,
      'BANK_TRANSFER',
      'UNPAID',
      'PENDING',
      'Test pending booking - should block availability',
      now(),
      now()
    ),
    (
      'bt9002',
      'TEST-20260624-02',
      v_user_2,
      v_court_1,
      '2026-06-24',
      '19:00',
      '20:00',
      180000,
      180000,
      180000,
      0,
      90000,
      'BANK_TRANSFER',
      'PAID',
      'CONFIRMED',
      'Test confirmed booking - should block availability',
      now(),
      now()
    ),
    (
      'bt9003',
      'TEST-20260624-03',
      v_user_3,
      v_court_1,
      '2026-06-24',
      '20:00',
      '21:00',
      180000,
      180000,
      180000,
      0,
      90000,
      'CASH',
      'PAID',
      'COMPLETED',
      'Test completed booking - should block availability',
      now(),
      now()
    ),
    (
      'bt9004',
      'TEST-20260624-04',
      v_user_1,
      v_court_1,
      '2026-06-24',
      '21:00',
      '22:00',
      180000,
      180000,
      180000,
      0,
      90000,
      'BANK_TRANSFER',
      'REFUNDED',
      'CANCELLED',
      'Test cancelled booking - should NOT block availability',
      now(),
      now()
    ),
    (
      'bt9005',
      'TEST-20260624-05',
      v_user_2,
      v_court_1,
      '2026-06-24',
      '22:00',
      '23:00',
      180000,
      180000,
      180000,
      0,
      90000,
      'CASH',
      'PARTIALLY_REFUNDED',
      'NO_SHOW',
      'Test no-show booking - should NOT block availability',
      now(),
      now()
    ),
    (
      'bt9006',
      'TEST-20260624-06',
      v_user_3,
      v_court_2,
      '2026-06-24',
      '17:00',
      '19:00',
      360000,
      360000,
      360000,
      0,
      180000,
      'E_WALLET',
      'PAID',
      'CONFIRMED',
      'Test second court confirmed booking',
      now(),
      now()
    )
  on conflict (id) do update
  set
    booking_code = excluded.booking_code,
    user_id = excluded.user_id,
    court_id = excluded.court_id,
    booking_date = excluded.booking_date,
    start_time = excluded.start_time,
    end_time = excluded.end_time,
    total_price = excluded.total_price,
    base_price = excluded.base_price,
    subtotal = excluded.subtotal,
    voucher_discount_amount = excluded.voucher_discount_amount,
    deposit_amount = excluded.deposit_amount,
    payment_method = excluded.payment_method,
    payment_status = excluded.payment_status,
    booking_status = excluded.booking_status,
    note = excluded.note,
    updated_at = now();

  raise notice 'Seeded test bookings for court % and % on 2026-06-24', v_court_1, v_court_2;
end $$;

commit;

-- Quick check:
select
  id,
  booking_code,
  court_id,
  booking_date,
  start_time,
  end_time,
  booking_status,
  payment_status
from bookings
where id like 'bt9%'
order by court_id, start_time;
