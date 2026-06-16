-- Run once on an existing database before deploying the Cloudinary integration.
alter table court_images
  add column if not exists public_id text;
