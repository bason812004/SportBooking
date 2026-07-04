-- Court-level deposit configuration.
-- If deposit_percent is null or 0, the court does not require a deposit.
-- If set, it must be below 50 percent.

alter table courts
  add column if not exists deposit_percent numeric(5, 2) null;

alter table courts
  drop constraint if exists courts_deposit_percent_check;

alter table courts
  add constraint courts_deposit_percent_check
  check (deposit_percent is null or (deposit_percent >= 0 and deposit_percent < 50));
