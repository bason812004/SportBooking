-- Partner withdrawals (2026-10-29). Safe to run more than once; no data is changed.

-- The status check only allowed PENDING/APPROVED/REJECTED/PAID, while the payout flow also writes PROCESSING and
-- FAILED; CANCELLED is a partner taking back a request no admin has handled yet (its amount returns to the wallet).
alter table withdrawal_requests drop constraint if exists withdrawal_requests_status_check;
alter table withdrawal_requests add constraint withdrawal_requests_status_check check (
  status in ('PENDING', 'APPROVED', 'PROCESSING', 'PAID', 'REJECTED', 'FAILED', 'CANCELLED')
);
