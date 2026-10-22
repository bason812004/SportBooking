begin;

alter table audit_logs
  alter column actor_id type varchar(20)
  using actor_id::text;

commit;
