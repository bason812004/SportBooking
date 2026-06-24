-- Diagnose why a court does not appear in GET /api/courts.
-- The backend only lists courts that satisfy:
--   courts.approval_status = 'APPROVED'
--   courts.active_status = 'ACTIVE'
--   court_categories.status = 'ACTIVE'
-- Optional filters can also hide rows: keyword, district/city, sport category, price, location radius.

-- 1) Show court visibility flags.
select
  c.id,
  c.name,
  c.city,
  c.district,
  c.approval_status,
  c.active_status,
  c.latitude,
  c.longitude,
  cc.id as category_id,
  cc.name as category_name,
  cc.slug as category_slug,
  cc.status as category_status,
  count(distinct cp.id) as price_rows,
  count(distinct ci.id) as image_rows
from courts c
join court_categories cc on cc.id = c.category_id
left join court_prices cp on cp.court_id = c.id
left join court_images ci on ci.court_id = c.id
group by c.id, cc.id
order by c.created_at desc;

-- 2) Show only rows hidden from public search because of status/category.
select
  c.id,
  c.name,
  case
    when c.approval_status <> 'APPROVED' then 'court approval_status is not APPROVED'
    when c.active_status <> 'ACTIVE' then 'court active_status is not ACTIVE'
    when cc.status <> 'ACTIVE' then 'category status is not ACTIVE'
    else 'visible by status'
  end as reason
from courts c
join court_categories cc on cc.id = c.category_id
where c.approval_status <> 'APPROVED'
   or c.active_status <> 'ACTIVE'
   or cc.status <> 'ACTIVE'
order by c.created_at desc;

-- 3) Optional fix for your own manually inserted court.
-- Replace c0001 with your court id before running. Do not run this blindly for unverified partner data.
-- update courts
-- set approval_status = 'APPROVED',
--     active_status = 'ACTIVE',
--     updated_at = now()
-- where id = 'c0001';

-- 4) If sport filter fails, check category values.
select id, name, slug, status
from court_categories
order by name;

