-- Partner catalog, staff and dynamic pricing (2026-10-29). Safe to run more than once; no data is removed.

-- 1) Dynamic pricing rules may lower the price (off-peak / low-demand discounts): the value may be negative, within
--    -90%..+300% for a percentage and +/-10,000,000 VND for a fixed amount, and never 0.
alter table dynamic_pricing_rules drop constraint if exists dynamic_pricing_rules_adjustment_check;
alter table dynamic_pricing_rules add constraint dynamic_pricing_rules_adjustment_check check (
  price_adjustment_value <> 0
  and (
    (price_adjustment_type::text = 'PERCENTAGE' and price_adjustment_value between -90 and 300)
    or (price_adjustment_type::text <> 'PERCENTAGE' and price_adjustment_value between -10000000 and 10000000)
  )
);

-- Names were saved untrimmed (" Tăng 20%..."); the form trims them from now on.
update dynamic_pricing_rules set name = btrim(name) where name <> btrim(name);

-- 2) Access tokens issued before this moment stop working (set when a partner changes a staff member's password).
alter table users add column if not exists sessions_revoked_at timestamptz;
