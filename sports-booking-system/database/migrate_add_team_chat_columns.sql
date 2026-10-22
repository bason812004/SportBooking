-- Migration: add missing columns to team_post_messages
-- This fixes the P2010 error when querying team chat messages
-- because the raw SQL queries expect these columns to exist.

BEGIN;

-- Add message_type enum column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'team_post_messages'
      AND column_name = 'message_type'
  ) THEN
    ALTER TABLE team_post_messages
      ADD COLUMN message_type team_post_message_type NOT NULL DEFAULT 'TEXT';
  END IF;
END $$;

-- Add attachment_url
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'team_post_messages'
      AND column_name = 'attachment_url'
  ) THEN
    ALTER TABLE team_post_messages
      ADD COLUMN attachment_url text;
  END IF;
END $$;

-- Add attachment_name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'team_post_messages'
      AND column_name = 'attachment_name'
  ) THEN
    ALTER TABLE team_post_messages
      ADD COLUMN attachment_name text;
  END IF;
END $$;

-- Add attachment_size
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'team_post_messages'
      AND column_name = 'attachment_size'
  ) THEN
    ALTER TABLE team_post_messages
      ADD COLUMN attachment_size bigint;
  END IF;
END $$;

-- Add thumbnail_url
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'team_post_messages'
      AND column_name = 'thumbnail_url'
  ) THEN
    ALTER TABLE team_post_messages
      ADD COLUMN thumbnail_url text;
  END IF;
END $$;

-- Add mime_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'team_post_messages'
      AND column_name = 'mime_type'
  ) THEN
    ALTER TABLE team_post_messages
      ADD COLUMN mime_type varchar(100);
  END IF;
END $$;

-- Make content nullable (allows sending image-only messages)
ALTER TABLE team_post_messages
  ALTER COLUMN content DROP NOT NULL;

COMMIT;
