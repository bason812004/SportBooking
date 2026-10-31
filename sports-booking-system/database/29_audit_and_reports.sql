-- Audit log hardening and violation report handling (2026-10-28).
-- Run AFTER backend/src/scripts/reseal_audit_chain.ts: from here on audit_logs rows can no longer be changed.
-- Safe to run more than once.

-- 1) Actions the system takes on its own (a payout provider's confirmation, scheduled jobs) have no actor.
alter table audit_logs alter column actor_id drop not null;

-- 2) The audit log is append-only: an update, delete or truncate is refused, as for commission_transactions.
create or replace function prevent_audit_log_mutation()
returns trigger as $$
begin
  raise exception 'audit_logs is append-only; % is not allowed', tg_op;
end;
$$ language plpgsql;

drop trigger if exists trg_audit_logs_immutable on audit_logs;
create trigger trg_audit_logs_immutable
before update or delete on audit_logs
for each row execute function prevent_audit_log_mutation();

drop trigger if exists trg_audit_logs_no_truncate on audit_logs;
create trigger trg_audit_logs_no_truncate
before truncate on audit_logs
for each statement execute function prevent_audit_log_mutation();

-- 3) Reports: who decided and what they noted, told to the reporter.
alter table reports add column if not exists admin_note text;
alter table reports add column if not exists resolved_by varchar(20);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reports_resolved_by_fkey') then
    alter table reports add constraint reports_resolved_by_fkey foreign key (resolved_by) references users(id);
  end if;
end $$;

-- One open report per customer and court: sending again while the first waits changes nothing.
create unique index if not exists uq_reports_pending_user_court on reports(user_id, court_id) where status = 'PENDING';
create index if not exists idx_reports_court_status on reports(court_id, status);
