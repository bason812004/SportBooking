-- Migration: create missing enum types and team_post_message_reactions table
-- Fixes type cast errors and missing reactions table

BEGIN;

-- Create team_post_message_type enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'team_post_message_type'
  ) THEN
    CREATE TYPE team_post_message_type AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'SYSTEM');
  END IF;
END $$;

-- Create reaction_type enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'reaction_type'
  ) THEN
    CREATE TYPE reaction_type AS ENUM ('LIKE', 'LOVE', 'LAUGH', 'WOW', 'SAD', 'CLAP', 'FIRE');
  END IF;
END $$;

-- Create reactions table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'team_post_message_reactions'
  ) THEN
    CREATE TABLE team_post_message_reactions (
      id varchar(20) primary key default ('tp-react' || lpad(nextval('seq_team_post_message_reactions')::text, 4, '0')),
      message_id varchar(20) not null references team_post_messages(id) on delete cascade,
      user_id varchar(20) not null references users(id) on delete cascade,
      reaction varchar(20) not null,
      created_at timestamptz not null default now(),
      unique(message_id, user_id)
    );

    CREATE INDEX idx_team_post_message_reactions_message ON team_post_message_reactions(message_id);
  END IF;
END $$;

COMMIT;
