begin;

alter table moderation_history
  alter column actor_id type varchar(20)
  using actor_id::text;

commit;
