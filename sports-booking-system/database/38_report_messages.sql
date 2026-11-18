-- Violation reports: the conversation between the admins and the customer who reported (2026-11-05).
--   * An admin writes to the reporter while the report waits, and closes it with a decision (RESOLVED / REJECTED)
--     that says what was done; the reporter answers while it waits. Closed reports are read only.
--   * measures: what was done about the court when the report was closed, as the admin confirmed it. Measures the
--     system saw in the audit log carry that entry's id.
--   * Every message is part of the record of how the report was handled: rows are never changed or removed.
--   * Only adds a table; no existing row changes. Safe to run more than once.

create sequence if not exists seq_report_messages;

create table if not exists report_messages (
  id varchar(20) primary key default ('rm' || lpad(nextval('seq_report_messages')::text, 4, '0')),
  report_id varchar(20) not null references reports(id),
  author_id varchar(20) references users(id),
  author_role varchar(20) not null check (author_role in ('ADMIN', 'USER')),
  kind varchar(20) not null default 'MESSAGE' check (kind in ('MESSAGE', 'RESOLVED', 'REJECTED')),
  content text not null check (char_length(content) between 1 and 2000),
  measures jsonb,
  created_at timestamptz not null default now(),
  -- Only an admin closes a report.
  constraint report_messages_decision_by_admin check (kind = 'MESSAGE' or author_role = 'ADMIN')
);

create index if not exists idx_report_messages_report on report_messages(report_id, created_at);

create or replace function prevent_report_message_mutation()
returns trigger as $$
begin
  raise exception 'report_messages is append-only; % is not allowed', tg_op;
end;
$$ language plpgsql;

drop trigger if exists trg_report_messages_immutable on report_messages;
create trigger trg_report_messages_immutable
before update or delete on report_messages
for each row execute function prevent_report_message_mutation();
