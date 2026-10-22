-- Migration: Sync DB columns from uuid to varchar(20) to match schema mismatches
-- DB was originally created with varchar(20) but Prisma schema declares uuid

-- Fix User.id type
ALTER TABLE users ALTER COLUMN id TYPE varchar(20) USING id::varchar(20);

-- Fix Voucher
ALTER TABLE vouchers ALTER COLUMN id TYPE varchar(20) USING id::varchar(20);
ALTER TABLE vouchers ALTER COLUMN partner_id TYPE varchar(20) USING partner_id::varchar(20);
ALTER TABLE vouchers ALTER COLUMN court_id TYPE varchar(20) USING court_id::varchar(20);

-- Fix Court
ALTER TABLE courts ALTER COLUMN id TYPE varchar(20) USING id::varchar(20);
ALTER TABLE courts ALTER COLUMN partner_id TYPE varchar(20) USING partner_id::varchar(20);

-- Fix PartnerProfile
ALTER TABLE partner_profiles ALTER COLUMN id TYPE varchar(20) USING id::varchar(20);
ALTER TABLE partner_profiles ALTER COLUMN user_id TYPE varchar(20) USING user_id::varchar(20);

-- Fix UserVoucher (main culprit)
ALTER TABLE user_vouchers ALTER COLUMN id TYPE varchar(20) USING id::varchar(20);
ALTER TABLE user_vouchers ALTER COLUMN user_id TYPE varchar(20) USING user_id::varchar(20);
ALTER TABLE user_vouchers ALTER COLUMN voucher_id TYPE varchar(20) USING voucher_id::varchar(20);

-- Fix Booking
ALTER TABLE bookings ALTER COLUMN id TYPE varchar(20) USING id::varchar(20);
ALTER TABLE bookings ALTER COLUMN user_id TYPE varchar(20) USING user_id::varchar(20);
ALTER TABLE bookings ALTER COLUMN court_id TYPE varchar(20) USING court_id::varchar(20);

-- Fix Payment
ALTER TABLE payments ALTER COLUMN id TYPE varchar(20) USING id::varchar(20);
ALTER TABLE payments ALTER COLUMN user_id TYPE varchar(20) USING user_id::varchar(20);
ALTER TABLE payments ALTER COLUMN booking_id TYPE varchar(20) USING booking_id::varchar(20);

-- Other related tables (only if they exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'favorites') THEN
    ALTER TABLE favorites ALTER COLUMN id TYPE varchar(20) USING id::varchar(20);
    ALTER TABLE favorites ALTER COLUMN user_id TYPE varchar(20) USING user_id::varchar(20);
    ALTER TABLE favorites ALTER COLUMN court_id TYPE varchar(20) USING court_id::varchar(20);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reviews') THEN
    ALTER TABLE reviews ALTER COLUMN id TYPE varchar(20) USING id::varchar(20);
    ALTER TABLE reviews ALTER COLUMN user_id TYPE varchar(20) USING user_id::varchar(20);
    ALTER TABLE reviews ALTER COLUMN court_id TYPE varchar(20) USING court_id::varchar(20);
    ALTER TABLE reviews ALTER COLUMN booking_id TYPE varchar(20) USING booking_id::varchar(20);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    ALTER TABLE notifications ALTER COLUMN id TYPE varchar(20) USING id::varchar(20);
    ALTER TABLE notifications ALTER COLUMN user_id TYPE varchar(20) USING user_id::varchar(20);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'refresh_tokens') THEN
    ALTER TABLE refresh_tokens ALTER COLUMN id TYPE varchar(20) USING id::varchar(20);
    ALTER TABLE refresh_tokens ALTER COLUMN user_id TYPE varchar(20) USING user_id::varchar(20);
  END IF;
END $$;