-- One-off reconciliation of partner wallets with the records behind them (run 2026-10-28, after st0002 was taken
-- back and st0008 settled through the admin actions, which wrote their own audit entries).
--  1) Settlements left in PROCESSING by old seed data, a status the code never produces:
--     st0009 (booking NO_SHOW: the partner keeps the paid part) is settled, its net moves to the available balance;
--     st0010 (booking never paid: the platform collected nothing) is cancelled.
--  2) Every wallet is rebuilt to the invariants the wallet code keeps:
--     pending_balance  = net of the partner's PENDING platform settlements (settling or cancelling them later must
--                        find exactly that amount there);
--     total_withdrawn  = withdrawals actually PAID;
--     total_earned     = available + pending + money held by open withdrawals + total_withdrawn.
--     available_balance is kept: it holds opening balances from seed data that no record explains.
-- Safe to run more than once: a second run finds nothing to change.
BEGIN;

UPDATE partner_wallets w
SET available_balance = w.available_balance + s.net_amount, updated_at = now()
FROM settlements s
WHERE s.id = 'st0009' AND s.status = 'PROCESSING' AND w.partner_id = s.partner_id;

UPDATE settlements SET status = 'SETTLED', settled_at = now(), updated_at = now()
WHERE id = 'st0009' AND status = 'PROCESSING';

UPDATE settlements SET status = 'CANCELLED', updated_at = now()
WHERE id = 'st0010' AND status = 'PROCESSING';

UPDATE partner_wallets w
SET pending_balance = coalesce(pending.amount, 0),
    total_withdrawn = coalesce(paid.amount, 0),
    total_earned = w.available_balance + coalesce(pending.amount, 0) + coalesce(held.amount, 0) + coalesce(paid.amount, 0),
    updated_at = now()
FROM partner_profiles p
LEFT JOIN (
  SELECT partner_id, sum(net_amount) AS amount FROM settlements
  WHERE status = 'PENDING' AND collected_by = 'PLATFORM' GROUP BY partner_id
) pending ON pending.partner_id = p.id
LEFT JOIN (
  SELECT partner_id, sum(amount) AS amount FROM withdrawal_requests WHERE status = 'PAID' GROUP BY partner_id
) paid ON paid.partner_id = p.id
LEFT JOIN (
  SELECT partner_id, sum(amount) AS amount FROM withdrawal_requests
  WHERE status IN ('PENDING', 'APPROVED', 'PROCESSING') GROUP BY partner_id
) held ON held.partner_id = p.id
WHERE w.partner_id = p.id;

COMMIT;
