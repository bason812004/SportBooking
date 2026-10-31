-- Partner operations (2026-10-28): admin court locks, invoice locks at the counter, rentals holding stock.
-- Safe to run more than once.

-- 1) A court an admin locked stays locked until an admin opens it: the partner's own pause/resume cannot undo it.
alter table courts add column if not exists admin_locked_at timestamptz;
alter table courts add column if not exists admin_lock_reason text;

-- 2) An invoice locked at the counter (no more services added, changed or removed) is locked for every device.
alter table bookings add column if not exists invoice_locked_at timestamptz;
alter table bookings add column if not exists invoice_locked_by varchar(20);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_invoice_locked_by_fkey') then
    alter table bookings add constraint bookings_invoice_locked_by_fkey foreign key (invoice_locked_by) references users(id);
  end if;
end $$;

-- 3) Rental gear out with a customer is held in reserved_quantity (available = quantity - reserved), so a court cannot
--    rent out more than it owns. Start from what is out now; services without a stock row are not limited.
update service_inventories si
set reserved_quantity = coalesce(out.count, 0), updated_at = now()
from services s
left join (
  select service_id, count(*)::int as count from rental_items where status = 'RENTED' group by service_id
) out on out.service_id = s.id
where si.service_id = s.id and s.type = 'RENTAL_SERVICE';
