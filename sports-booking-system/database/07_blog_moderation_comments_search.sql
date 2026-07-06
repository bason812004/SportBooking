-- Blog moderation, comment toggle, and search support.
-- Safe for existing databases; run after 00_schema_tables.sql / 01_existing_db_migrations.sql.

alter table if exists blog_posts
  add column if not exists allow_comments boolean not null default true;

update blog_posts
set allow_comments = true
where allow_comments is null;

create index if not exists idx_blog_posts_public_search
  on blog_posts (status, visibility, published_at desc, created_at desc);

create index if not exists idx_blog_posts_allow_comments
  on blog_posts (allow_comments);
