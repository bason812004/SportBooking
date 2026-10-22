-- Convert services.id from uuid (gen_random_uuid()) to a sequence-based varchar id
-- ("sv0001", "sv0002", ...), matching the id convention already used by every other
-- table in this schema (e.g. court_categories "cc0001", bookings "b0001").
--
-- This was a deliberate choice made after diagnosing that mobile bookings/quote crashed
-- with Prisma P2023 ("Error creating UUID, invalid character") because court_services.id
-- values (varchar "cs..." style) were being compared against services.id (uuid) in
-- bookingPricing.service.ts. Note: migration 13_fix_service_enums_and_ids.sql previously
-- solved the same class of bug the other way (splitting booking_services.service_id into
-- separate uuid/varchar columns) -- this migration instead unifies both id spaces on varchar.
--
-- Updates services.id plus the 6 FK columns that reference it:
--   court_services.service_id, booking_services.service_id, service_inventories.service_id,
--   inventory_transactions.service_id, purchase_order_items.service_id, rental_items.service_id
--
-- Safe to run multiple times.

begin;

create sequence if not exists seq_services;

do $$
declare
  services_udt text;
  r record;
  fk record;
  join_clause text;
begin
  select c.udt_name into services_udt
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'services' and c.column_name = 'id';

  -- Nothing to do if services table doesn't exist yet, or id is already varchar.
  if services_udt is null or services_udt = 'varchar' then
    return;
  end if;

  -- 1) New varchar id column on services, backfilled in a stable order.
  alter table services add column if not exists new_id varchar(20);
  update services set new_id = 'sv' || lpad(nextval('seq_services')::text, 4, '0')
  where new_id is null;

  -- 2) For each referencing table: drop its FK to services, add+backfill a new varchar
  -- column (via a ::text join so it works whether the existing column is uuid or varchar),
  -- drop the old column, rename the new one into place, then restore NOT NULL/UNIQUE.
  for r in
    select * from (values
      ('court_services',        'service_id', 20,  false, false),
      ('booking_services',      'service_id', 50,  false, false),
      ('service_inventories',   'service_id', 20,  true,  true),
      ('inventory_transactions','service_id', 20,  false, true),
      ('purchase_order_items',  'service_id', 20,  false, true),
      ('rental_items',          'service_id', 20,  false, true)
    ) as t(table_name, column_name, new_width, is_unique, is_not_null)
  loop
    -- Table/column may not exist in every environment; skip quietly if so.
    if not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = r.table_name and c.column_name = r.column_name
    ) then
      continue;
    end if;

    -- Drop any FK constraint from this table/column pointing at services, regardless of name.
    for fk in
      select tc.constraint_name
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
      where tc.constraint_type = 'FOREIGN KEY'
        and tc.table_schema = 'public'
        and tc.table_name = r.table_name
        and kcu.column_name = r.column_name
        and ccu.table_name = 'services'
    loop
      execute format('alter table %I drop constraint %I', r.table_name, fk.constraint_name);
    end loop;

    execute format('alter table %I add column if not exists new_%I varchar(%s)', r.table_name, r.column_name, r.new_width);
    execute format(
      'update %I t set %I = s.new_id from services s where t.%I is not null and t.%I::text = s.id::text',
      r.table_name, 'new_' || r.column_name, r.column_name, r.column_name
    );

    execute format('alter table %I drop column %I', r.table_name, r.column_name);
    execute format('alter table %I rename column %I to %I', r.table_name, 'new_' || r.column_name, r.column_name);

    if r.is_not_null then
      execute format('alter table %I alter column %I set not null', r.table_name, r.column_name);
    end if;
    if r.is_unique then
      execute format('alter table %I add constraint %I unique (%I)', r.table_name, r.table_name || '_' || r.column_name || '_key', r.column_name);
    end if;
  end loop;

  -- 3) Swap services.id itself: drop old uuid id (now unreferenced), promote new_id.
  alter table services drop constraint if exists services_pkey;
  alter table services alter column id drop default;
  alter table services drop column id;
  alter table services rename column new_id to id;
  alter table services alter column id set not null;
  alter table services add primary key (id);
  alter table services alter column id set default ('sv' || lpad(nextval('seq_services')::text, 4, '0'));

  -- 4) Re-add the 6 FK constraints, matching the ON DELETE behavior declared in schema.prisma.
  alter table court_services
    add constraint court_services_service_id_fkey foreign key (service_id) references services(id) on delete cascade;
  alter table booking_services
    add constraint booking_services_service_id_fkey foreign key (service_id) references services(id) on delete no action;
  alter table service_inventories
    add constraint service_inventories_service_id_fkey foreign key (service_id) references services(id) on delete cascade;
  alter table inventory_transactions
    add constraint inventory_transactions_service_id_fkey foreign key (service_id) references services(id) on delete cascade;
  alter table purchase_order_items
    add constraint purchase_order_items_service_id_fkey foreign key (service_id) references services(id) on delete no action;
  alter table rental_items
    add constraint rental_items_service_id_fkey foreign key (service_id) references services(id) on delete no action;
end $$;

commit;
