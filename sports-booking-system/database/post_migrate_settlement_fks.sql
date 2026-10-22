-- ============================================================
-- Post-migration: ensure FK constraints that should exist
-- on new settlement tables
-- ============================================================

-- partner_wallets.partner_id -> partner_profiles.id (ON DELETE CASCADE)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'partner_wallets_partner_id_fkey'
  ) then
    alter table partner_wallets
      add constraint partner_wallets_partner_id_fkey
      foreign key (partner_id) references partner_profiles(id) on delete cascade;
  end if;
end $$;

-- settlements.booking_id -> bookings.id
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'settlements_booking_id_fkey'
  ) then
    alter table settlements
      add constraint settlements_booking_id_fkey
      foreign key (booking_id) references bookings(id);
  end if;
end $$;

-- settlements.partner_id -> partner_profiles.id
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'settlements_partner_id_fkey'
  ) then
    alter table settlements
      add constraint settlements_partner_id_fkey
      foreign key (partner_id) references partner_profiles(id);
  end if;
end $$;

-- settlements.payment_id -> payments.id
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'settlements_payment_id_fkey'
  ) then
    alter table settlements
      add constraint settlements_payment_id_fkey
      foreign key (payment_id) references payments(id);
  end if;
end $$;

-- withdrawal_requests.partner_id -> partner_profiles.id
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'withdrawal_requests_partner_id_fkey'
  ) then
    alter table withdrawal_requests
      add constraint withdrawal_requests_partner_id_fkey
      foreign key (partner_id) references partner_profiles(id);
  end if;
end $$;

-- withdrawal_requests.processed_by -> users.id
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'withdrawal_requests_processed_by_fkey'
  ) then
    alter table withdrawal_requests
      add constraint withdrawal_requests_processed_by_fkey
      foreign key (processed_by) references users(id);
  end if;
end $$;
