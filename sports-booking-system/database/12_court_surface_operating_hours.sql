-- Adds optional per-surface opening/closing hours to court_surfaces.
-- Nullable: existing surfaces have no per-surface hours and keep falling back
-- to the parent court's opening_time/closing_time until a partner sets them.
alter table court_surfaces
  add column if not exists opening_time time(6) null,
  add column if not exists closing_time time(6) null;
