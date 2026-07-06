-- Add popularity counters used by public blog and voucher recommendations.

alter table if exists blog_posts
  add column if not exists view_count integer not null default 0;

alter table if exists vouchers
  add column if not exists click_count integer not null default 0;

create index if not exists idx_blog_posts_public_popularity
  on blog_posts (view_count desc, published_at desc, created_at desc)
  where status = 'PUBLISHED'::blog_post_status and visibility = 'PUBLIC'::blog_visibility;

create index if not exists idx_vouchers_public_popularity
  on vouchers (click_count desc, used_count desc, created_at desc)
  where status = 'ACTIVE'::voucher_status;
