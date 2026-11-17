-- 1) Commission ledger adjustments. commission_transactions is immutable (trigger) and holds one EARNING per booking,
--    so an earning that grows afterwards (an extension, a platform-funded voucher paid back, a no-show corrected to
--    completed) is recorded as an ADJUSTMENT row with positive amounts pointing at the earning. Before this, the code
--    tried to UPDATE the earning, which the trigger refuses, and the whole booking completion failed with it.
ALTER TABLE commission_transactions DROP CONSTRAINT IF EXISTS commission_transactions_transaction_type_check;
ALTER TABLE commission_transactions ADD CONSTRAINT commission_transactions_transaction_type_check
  CHECK (transaction_type IN ('EARNING', 'REVERSAL', 'ADJUSTMENT'));
ALTER TABLE commission_transactions DROP CONSTRAINT IF EXISTS commission_transaction_sign_check;
ALTER TABLE commission_transactions ADD CONSTRAINT commission_transaction_sign_check CHECK (
  (transaction_type IN ('EARNING', 'ADJUSTMENT') AND commission_amount >= 0 AND net_amount >= 0)
  OR (transaction_type = 'REVERSAL' AND commission_amount <= 0 AND net_amount <= 0)
);

-- 2) Overdue bookings. A booking still open (confirmed or checked in) after its end time is reminded to the court's
--    staff after 2 hours and finished by the system after 48 (booking-overdue job): overdue_reminded_at and
--    auto_finished_at record each step, so neither happens twice and an automatic no-show can be corrected.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS overdue_reminded_at timestamptz(6),
  ADD COLUMN IF NOT EXISTS auto_finished_at timestamptz(6);

-- 3) The job only handles bookings played from the day it was switched on (YYYYMMDD, Vietnam time); bookings left
--    open before that, test data included, stay as they are.
INSERT INTO system_settings (key, numeric_value, description)
VALUES (
  'BOOKING_AUTO_FINISH_FROM_DATE',
  to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYYMMDD')::numeric,
  'Bookings dated from this day (YYYYMMDD) are reminded and finished automatically once overdue'
)
ON CONFLICT (key) DO NOTHING;
