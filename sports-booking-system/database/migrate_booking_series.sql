-- Recurring (weekly) walk-in bookings created by Recipient staff.
-- Adds a booking_series group table plus a nullable link on bookings so a
-- batch of weekly occurrences can later be viewed/cancelled together.

create sequence if not exists seq_booking_series;

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

  if not exists (select 1 from information_schema.tables where table_name = 'booking_series') then
    execute format(
      $sql$
        create table booking_series (
          id varchar(20) primary key default ('bs' || lpad(nextval('seq_booking_series')::text, 4, '0')),
          court_id varchar(20) not null references courts(id),
          court_surface_id %s references court_surfaces(id) on delete set null,
          created_by_user_id varchar(20) not null references users(id),
          customer_name varchar(120) not null,
          customer_phone varchar(30) not null,
          start_time time not null,
          duration_minutes int not null check (duration_minutes > 0),
          first_booking_date date not null,
          occurrences_requested int not null check (occurrences_requested > 0),
          note text,
          created_at timestamptz not null default now()
        )
      $sql$,
      surface_type
    );
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_name = 'bookings'
      and column_name = 'booking_series_id'
  ) then
    alter table bookings add column booking_series_id varchar(20);
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where table_name = 'bookings'
      and constraint_name = 'bookings_booking_series_id_fkey'
  ) then
    alter table bookings
      add constraint bookings_booking_series_id_fkey
      foreign key (booking_series_id) references booking_series(id) on delete set null;
  end if;
end $$;

create index if not exists idx_bookings_booking_series_id
  on bookings(booking_series_id);
