-- ============================================================
-- Booking Order Migration — cho phép 1 lần thanh toán bao gồm
-- nhiều ngày đặt sân khác nhau (mỗi ngày vẫn là 1 booking riêng).
-- Chạy: Supabase Dashboard > SQL Editor > New query > paste
-- Idempotent: dùng IF NOT EXISTS
-- ============================================================

create sequence if not exists seq_booking_orders;

create table if not exists booking_orders (
  id varchar(20) primary key default ('bo' || lpad(nextval('seq_booking_orders')::text, 4, '0')),
  user_id varchar(20) not null references users(id),
  court_id varchar(20) not null references courts(id),
  subtotal numeric(12, 2) not null default 0,
  voucher_discount_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  payment_type varchar(20) not null,
  status varchar(20) not null default 'PENDING',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_booking_orders_user_id on booking_orders(user_id);

alter table bookings add column if not exists booking_order_id varchar(20) references booking_orders(id) on delete set null;
create index if not exists idx_bookings_booking_order_id on bookings(booking_order_id);

alter table payments add column if not exists booking_order_id varchar(20) unique references booking_orders(id) on delete set null;
