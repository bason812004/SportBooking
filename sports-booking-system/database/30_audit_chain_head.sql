-- The audit chain's head (2026-10-28): one row holding the newest entry's hash.
-- recordAdminAction locks this row (select ... for update) before chaining an entry and moves it after, so entries
-- chain one at a time under any isolation level, including the booking-overdue job's Serializable transaction.
-- Verifying the chain also compares its last entry with this row, which shows a chain cut short at its end.
-- Safe to run more than once.

create table if not exists audit_chain_head (
  id smallint primary key default 1 check (id = 1),
  current_hash varchar(64),
  updated_at timestamptz not null default now()
);

insert into audit_chain_head (id, current_hash)
select 1, (select current_hash from audit_logs order by created_at desc, id desc limit 1)
on conflict (id) do nothing;
