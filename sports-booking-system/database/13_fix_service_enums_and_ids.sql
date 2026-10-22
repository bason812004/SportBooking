-- Fix mismatch between schema.prisma and actual Supabase DB after merging
-- feature/auth-chat-avatar-perf into feature/admin (cashier/checkout/inventory/services modules).
--
-- Context: tables service_categories/services/service_inventories/inventory_transactions/
-- suppliers/purchase_orders/purchase_order_items/rental_items/checkouts/checkout_payments
-- and the extra columns on booking_services already exist, but:
--   1) the 4 new Postgres enum types declared in schema.prisma were never created
--      (services.type / status, checkouts.status, inventory_transactions.type,
--      rental_items.status are stored as plain varchar instead)
--   2) booking_services.service_id is still varchar and mixes old-style ids
--      (e.g. "cs0001", referencing court_services) with new UUID values
--      (referencing services). schema.prisma expects service_id to be uuid.
--
-- Safe to run multiple times.

begin;

-- 1) Create the 4 missing enum types (guarded, Postgres has no "create type if not exists")
do $$
begin
  if not exists (select 1 from pg_type where typname = 'service_type') then
    create type service_type as enum ('PRODUCT', 'RENTAL_SERVICE');
  end if;

  if not exists (select 1 from pg_type where typname = 'inventory_tx_type') then
    create type inventory_tx_type as enum ('IMPORT', 'SALE', 'RENTAL_OUT', 'RENTAL_IN', 'ADJUSTMENT', 'DAMAGED', 'LOST');
  end if;

  if not exists (select 1 from pg_type where typname = 'rental_status') then
    create type rental_status as enum ('AVAILABLE', 'RENTED', 'RETURNED', 'DAMAGED', 'LOST');
  end if;

  if not exists (select 1 from pg_type where typname = 'checkout_status') then
    create type checkout_status as enum ('PENDING', 'COMPLETED', 'CANCELLED');
  end if;
end $$;

-- 2) Convert varchar columns that should use the enums above (or existing enums) to their
-- real enum type, only if they are not already that type. Default is dropped/recreated
-- around the type change so Postgres can cast the existing default literal safely.
do $$
declare
  r record;
  current_udt text;
begin
  for r in
    select * from (values
      ('services', 'type', 'service_type', 'PRODUCT'),
      ('services', 'status', 'court_active_status', 'ACTIVE'),
      ('checkouts', 'status', 'checkout_status', 'PENDING'),
      ('inventory_transactions', 'type', 'inventory_tx_type', null),
      ('rental_items', 'status', 'rental_status', 'RENTED'),
      ('checkout_payments', 'status', 'payment_status', 'PAID'),
      ('checkout_payments', 'payment_method', 'payment_method', null)
    ) as t(table_name, column_name, enum_name, default_value)
  loop
    select c.udt_name into current_udt
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = r.table_name
      and c.column_name = r.column_name;

    if current_udt is not null and current_udt <> r.enum_name then
      execute format('alter table %I alter column %I drop default', r.table_name, r.column_name);
      execute format(
        'alter table %I alter column %I type %I using %I::text::%I',
        r.table_name, r.column_name, r.enum_name, r.column_name, r.enum_name
      );
      if r.default_value is not null then
        execute format('alter table %I alter column %I set default %L::%I', r.table_name, r.column_name, r.default_value, r.enum_name);
      end if;
    end if;
  end loop;
end $$;

-- 3) booking_services.service_id: split old-style ids (e.g. "cs0001") into court_service_id
-- before converting service_id to uuid, so nothing is lost.
do $$
declare
  current_udt text;
begin
  select c.udt_name into current_udt
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'booking_services'
    and c.column_name = 'service_id';

  if current_udt is not null and current_udt <> 'uuid' then
    alter table booking_services alter column service_id drop not null;

    update booking_services
    set court_service_id = service_id,
        service_id = null
    where service_id is not null
      and court_service_id is null
      and service_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

    -- any leftover non-UUID values (court_service_id already populated) can't be cast;
    -- null them out instead of aborting the migration, since court_service_id already
    -- carries the reference for those rows.
    update booking_services
    set service_id = null
    where service_id is not null
      and service_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

    alter table booking_services
      alter column service_id type uuid using service_id::uuid;
  end if;
end $$;

commit;
