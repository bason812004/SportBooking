create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_id varchar(20) not null references users(id),
  action varchar(100) not null,
  entity_type varchar(80) not null,
  entity_id varchar(100) not null,
  metadata jsonb,
  previous_hash varchar(64),
  current_hash varchar(64) not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_created_at on audit_logs(created_at desc);
create index if not exists idx_audit_logs_actor_id on audit_logs(actor_id);

create table if not exists blockchain_logs (
  id uuid primary key default uuid_generate_v4(),
  audit_log_id uuid references audit_logs(id),
  entity_type varchar(80) not null,
  entity_id varchar(100) not null,
  payload_hash varchar(64) not null,
  network varchar(80) not null default 'NOT_CONFIGURED',
  tx_hash varchar(120),
  status varchar(30) not null default 'PENDING',
  error text,
  attempts integer not null default 0,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_blockchain_logs_status on blockchain_logs(status);
create index if not exists idx_blockchain_logs_created_at on blockchain_logs(created_at desc);

create table if not exists moderation_history (
  id uuid primary key default uuid_generate_v4(),
  entity_type varchar(80) not null,
  entity_id varchar(100) not null,
  action varchar(50) not null,
  reason text,
  actor_id varchar(20) not null references users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_moderation_history_entity
  on moderation_history(entity_type, entity_id, created_at desc);

