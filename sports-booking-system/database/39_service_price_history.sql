-- Service price history (2026-11-06): when a service's sale price (price) or cost price (cost_price) was set, from what
-- to what, and by whom.
--   * kind INITIAL: the price each existing service had when recording started. Its changed_at is the moment this
--     migration ran, not when that price was really set (that was never recorded).
--   * kind CREATED: the price a service was created with; CHANGED: a later change of either price (old and new kept).
--   * Rows are never edited or removed, except: changed_by is cleared when that user account is deleted, and a
--     service deleted before it was ever used takes its history with it.
--   * The backend creates the same table when it starts (services/service.repository.ts, with the other service
--     tables), so this file is for an existing database. It adds a table and one INITIAL row per service that has no
--     history yet; no existing row changes. Safe to run more than once.

create sequence if not exists seq_service_price_history;

create table if not exists service_price_history (
  id varchar(20) primary key default ('sph' || lpad(nextval('seq_service_price_history')::text, 5, '0')),
  service_id varchar(20) not null references services(id) on delete cascade,
  kind varchar(10) not null check (kind in ('INITIAL', 'CREATED', 'CHANGED')),
  old_price decimal(12, 2),
  new_price decimal(12, 2) not null check (new_price >= 0),
  old_cost_price decimal(12, 2),
  new_cost_price decimal(12, 2) not null check (new_cost_price >= 0),
  changed_by varchar(20) references users(id) on delete set null,
  changed_at timestamptz not null default now(),
  constraint service_price_history_change_has_old check (kind <> 'CHANGED' or (old_price is not null and old_cost_price is not null))
);

create index if not exists idx_service_price_history_service on service_price_history(service_id, changed_at desc);

create or replace function prevent_service_price_history_mutation()
returns trigger as $$
begin
  -- The one allowed edit: the user who made the change was deleted (on delete set null).
  if new.changed_by is null and old.changed_by is not null
     and (new.id, new.service_id, new.kind, new.old_price, new.new_price, new.old_cost_price, new.new_cost_price, new.changed_at)
         is not distinct from (old.id, old.service_id, old.kind, old.old_price, old.new_price, old.old_cost_price, old.new_cost_price, old.changed_at) then
    return new;
  end if;
  raise exception 'service_price_history is append-only; UPDATE is not allowed';
end;
$$ language plpgsql;

drop trigger if exists trg_service_price_history_immutable on service_price_history;
create trigger trg_service_price_history_immutable
before update on service_price_history
for each row execute function prevent_service_price_history_mutation();

-- Starting point: each service's current prices.
insert into service_price_history (service_id, kind, new_price, new_cost_price)
select s.id, 'INITIAL', s.price, coalesce(s.cost_price, 0)
from services s
where not exists (select 1 from service_price_history h where h.service_id = s.id);
