-- ============================================================
-- Add missing public_id column to court_images (Cloudinary)
-- Idempotent: IF NOT EXISTS
-- ============================================================

ALTER TABLE court_images
  ADD COLUMN IF NOT EXISTS public_id varchar(200);