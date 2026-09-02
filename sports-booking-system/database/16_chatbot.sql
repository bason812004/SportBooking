-- AI chatbot: conversation history (authenticated users only) and pending-booking
-- confirmation records used by the chat "book for me" flow.
-- Safe for existing databases; run after users, courts, bookings exist.

create sequence if not exists seq_chat_conversations;
create sequence if not exists seq_chat_messages;
create sequence if not exists seq_pending_bookings;

create table if not exists chat_conversations (
  id varchar(20) primary key default ('cc' || lpad(nextval('seq_chat_conversations')::text, 4, '0')),
  user_id varchar(20) not null references users(id) on delete cascade,
  title varchar(160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_chat_conversations_user_updated
  on chat_conversations(user_id, updated_at desc);

create table if not exists chat_messages (
  id varchar(20) primary key default ('cm' || lpad(nextval('seq_chat_messages')::text, 4, '0')),
  conversation_id varchar(20) not null references chat_conversations(id) on delete cascade,
  role varchar(20) not null,
  content text not null,
  tool_calls_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_messages_conversation_created
  on chat_messages(conversation_id, created_at);

create table if not exists pending_bookings (
  id varchar(20) primary key default ('pb' || lpad(nextval('seq_pending_bookings')::text, 4, '0')),
  user_id varchar(20) not null references users(id) on delete cascade,
  quote_payload jsonb not null,
  quote_summary jsonb not null,
  status varchar(20) not null default 'PENDING',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_pending_bookings_user_status
  on pending_bookings(user_id, status);
