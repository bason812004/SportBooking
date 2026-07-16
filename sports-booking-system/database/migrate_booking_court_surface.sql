-- Link each booking to the exact child court/surface used by the customer.
-- The column type follows court_surfaces.id so this works for both varchar-id
-- seed databases and uuid-id migrated databases.

do $$
declare
  surface_type text;
begin
  select
    case
      when data_type = 'uuid' then 'uuid'
      when data_type = 'character varying' and character_maximum_length is not null then 'varchar(' || character_maximum_length || ')'
      when data_type = 'character varying' then 'varchar'
      else udt_name
    end
  into surface_type
  from information_schema.columns
  where table_name = 'court_surfaces'
    and column_name = 'id';

  if surface_type is null then
    raise exception 'court_surfaces.id column was not found';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_name = 'bookings'
      and column_name = 'court_surface_id'
  ) then
    execute format('alter table bookings add column court_surface_id %s', surface_type);
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where table_name = 'bookings'
      and constraint_name = 'bookings_court_surface_id_fkey'
  ) then
    alter table bookings
      add constraint bookings_court_surface_id_fkey
      foreign key (court_surface_id) references court_surfaces(id) on delete set null;
  end if;
end $$;

create index if not exists idx_bookings_court_surface_id
  on bookings(court_surface_id);
