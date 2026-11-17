-- Vietnam's 2025 administrative reform removed the district level: an address is now
-- street address + ward/commune (phường/xã) + province/city. New courts are registered without
-- a district; courts registered before keep theirs (still shown and searchable).
-- Additive; safe to run more than once. Run `npx prisma generate` in backend afterwards.
ALTER TABLE courts ALTER COLUMN district DROP NOT NULL;
