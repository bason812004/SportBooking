begin;

create sequence if not exists seq_notification_campaigns;

create table if not exists notification_campaigns (
  id varchar(20) primary key default ('nc' || lpad(nextval('seq_notification_campaigns')::text, 4, '0')),
  title varchar(160) not null,
  content text not null,
  type varchar(80) not null,
  target_type varchar(30) not null check (target_type in ('ALL', 'ROLE', 'USER', 'PARTNER')),
  target_role varchar(20) check (target_role is null or target_role in ('USER', 'PARTNER', 'ADMIN')),
  target_user_id varchar(20) references users(id) on delete set null,
  target_partner_id varchar(20) references partner_profiles(id) on delete set null,
  sent_by varchar(20) references users(id) on delete set null,
  recipient_count integer not null default 0 check (recipient_count >= 0),
  metadata_json jsonb,
  created_at timestamptz not null default now(),
  constraint notification_campaign_target_check check (
    (target_type = 'ALL' and target_role is null and target_user_id is null and target_partner_id is null)
    or (target_type = 'ROLE' and target_role is not null and target_user_id is null and target_partner_id is null)
    or (target_type = 'USER' and target_user_id is not null and target_role is null and target_partner_id is null)
    or (target_type = 'PARTNER' and target_partner_id is not null and target_role is null and target_user_id is null)
  )
);

alter table notifications
  add column if not exists campaign_id varchar(20) references notification_campaigns(id) on delete set null;

create index if not exists idx_notification_campaigns_created_at
  on notification_campaigns(created_at desc);
create index if not exists idx_notification_campaigns_sent_by
  on notification_campaigns(sent_by);
create index if not exists idx_notifications_campaign_id
  on notifications(campaign_id);
create index if not exists idx_notifications_type
  on notifications(type);
create index if not exists idx_notifications_created_at
  on notifications(created_at desc);

commit;
