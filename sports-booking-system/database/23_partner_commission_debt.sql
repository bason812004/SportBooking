-- Commission on money a partner collects directly (cash, the partner's own QR code, bank transfer) is charged
-- to the partner wallet when the booking completes. Whatever the available balance cannot cover becomes
-- commission_debt, paid off by later online earnings or by a transfer to the platform account that an admin
-- records in partner_commission_debt_payments.
-- Additive only; safe to run more than once. Run `npx prisma generate` in backend afterwards.
ALTER TABLE partner_wallets
  ADD COLUMN IF NOT EXISTS commission_debt numeric(12, 2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'partner_wallets_commission_debt_check') THEN
    ALTER TABLE partner_wallets ADD CONSTRAINT partner_wallets_commission_debt_check CHECK (commission_debt >= 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS partner_commission_debt_payments (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  partner_id varchar(20) NOT NULL REFERENCES partner_profiles(id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  note text,
  recorded_by varchar(20) NOT NULL REFERENCES users(id),
  created_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_debt_payments_partner_created_at
  ON partner_commission_debt_payments (partner_id, created_at DESC);
