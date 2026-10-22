-- Add Recipient accounts that belong to a partner and manage one court.
-- Demo login:
--   Email: partner1+recipient@sportsbooking.com
--   Password: 123456

alter type user_role add value if not exists 'RECIPIENT';

alter table users
  add column if not exists partner_id varchar(20);

alter table users
  add column if not exists managed_court_id varchar(20);

alter table users
  drop constraint if exists users_partner_id_fkey;

alter table users
  drop constraint if exists users_managed_court_id_fkey;

alter table users
  add constraint users_partner_id_fkey
  foreign key (partner_id) references partner_profiles(id) on delete cascade;

alter table users
  add constraint users_managed_court_id_fkey
  foreign key (managed_court_id) references courts(id) on delete set null;

create index if not exists idx_users_partner_id on users(partner_id);
create index if not exists idx_users_managed_court_id on users(managed_court_id);

insert into users (
  id, full_name, email, phone, password_hash, role, provider, provider_id,
  email_verified, status, partner_id, managed_court_id
)
select
  'u0091',
  'Recipient San Sala',
  'partner1+recipient@sportsbooking.com',
  '0900000091',
  crypt('123456', gen_salt('bf', 10)),
  'RECIPIENT'::user_role,
  'LOCAL'::auth_provider,
  null,
  true,
  'ACTIVE'::account_status,
  'pp0001',
  'c0001'
where exists (select 1 from partner_profiles where id = 'pp0001')
  and exists (select 1 from courts where id = 'c0001' and partner_id = 'pp0001')
on conflict (email) do update set
  full_name = excluded.full_name,
  phone = excluded.phone,
  password_hash = excluded.password_hash,
  role = excluded.role,
  provider = excluded.provider,
  provider_id = excluded.provider_id,
  email_verified = excluded.email_verified,
  status = excluded.status,
  partner_id = excluded.partner_id,
  managed_court_id = excluded.managed_court_id,
  updated_at = now();
