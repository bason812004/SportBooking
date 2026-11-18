-- Stock can never go below zero (2026-11-06).
--   Every sale now takes stock through one function that locks the row and checks what is free
--   (backend/src/modules/inventory/inventory.stock.ts); these checks are the last line: a count that would go
--   negative (on hand, or rental pieces held) is refused by the database, whatever wrote it.
--   Only adds two CHECK constraints. Checked before adding: no row breaks them (214 rows, none negative on 2026-11-06).
--   Safe to run more than once.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'service_inventories_quantity_non_negative') then
    alter table service_inventories
      add constraint service_inventories_quantity_non_negative check (quantity >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'service_inventories_reserved_non_negative') then
    alter table service_inventories
      add constraint service_inventories_reserved_non_negative check (reserved_quantity >= 0);
  end if;
end $$;
