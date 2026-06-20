create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'verification_purpose') then
    create type verification_purpose as enum ('REGISTER', 'FORGOT_PASSWORD', 'CHANGE_EMAIL');
  end if;
end $$;

create table if not exists email_verification_codes (
  id uuid primary key default gen_random_uuid(),
  email varchar(160) not null,
  full_name varchar(120) not null,
  phone varchar(30),
  password_hash text not null,
  otp_hash text not null,
  purpose verification_purpose not null default 'REGISTER',
  expires_at timestamptz not null,
  verified_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 5 check (max_attempts > 0),
  resend_count integer not null default 0 check (resend_count >= 0),
  last_sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_email_verification_codes_email_purpose unique (email, purpose)
);

create index if not exists idx_email_verification_codes_expires_at
  on email_verification_codes(expires_at);

alter table email_verification_codes add column if not exists account_type varchar(20) not null default 'USER';
alter table email_verification_codes add column if not exists business_name varchar(180);
alter table email_verification_codes add column if not exists address text;
alter table email_verification_codes add column if not exists verification_document_url text;
