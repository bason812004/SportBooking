-- Adds optional court_surface_id scoping to court_availability_blocks so a maintenance/
-- closure block can target a single court surface instead of the whole court complex.
alter table court_availability_blocks
  add column if not exists court_surface_id varchar(20) references court_surfaces(id) on delete cascade;

create index if not exists idx_court_availability_blocks_surface
  on court_availability_blocks(court_surface_id, block_date, start_time, end_time, status);
