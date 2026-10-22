-- Migration: Performance indexes for weekly schedule endpoint and team_post_members consistency.
-- Safe on populated databases (every statement is idempotent).

create index if not exists idx_court_availability_blocks_lookup
  on court_availability_blocks(court_id, block_date, start_time, end_time)
  where status = 'ACTIVE';

create index if not exists idx_dynamic_pricing_rules_active_lookup
  on dynamic_pricing_rules(court_id, is_active, day_type);
