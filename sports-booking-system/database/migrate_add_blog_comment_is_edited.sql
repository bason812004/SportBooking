-- Migration: add is_edited column to blog_comments
-- This fixes the query that references is_edited column.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'blog_comments'
      AND column_name = 'is_edited'
  ) THEN
    ALTER TABLE blog_comments
      ADD COLUMN is_edited boolean NOT NULL DEFAULT false;
  END IF;
END $$;

COMMIT;
