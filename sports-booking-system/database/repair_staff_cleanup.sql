-- One-off repair and cleanup (2026-10-29), approved by the user after the staff-counter review. One DO block: every
-- step checks how many rows it touched against the inventory taken just before, and any surprise aborts the whole
-- thing with nothing changed. A second run finds nothing left to do (every step then touches 0 rows).
--
-- 1) The old "orphan fixup" of the staff booking list (removed) had also moved, besides the 42 bookings repaired in
--    repair_moved_staff_bookings.sql, 30 sample bookings of 02_seed_data.sql and the 913 demand-prediction demo
--    bookings (BK-DEMAND-c0003-*, BK-DEMAND-c0021-*) onto court c0001, sub-court csf0021. They go back to the court the
--    seed file and the booking code name (their reviews and commission rows already name that court and partner),
--    with no sub-court, as they were created.
-- 2) Bookings that test scripts left on c0001 (CHECKIN-DEMO-, DEMO260731-, POS-TEST-, TEST-, BK-TEST-) are deleted with
--    what hangs off them: settlements, service lines, checkouts, rentals, notifications. Only the 26 without a commission
--    row: commission_transactions is an append-only ledger (a trigger refuses deletes), so the 18 that earned commission
--    stay. Their 2 settlements were cancelled (no wallet money); should a SETTLED platform settlement be among them, its
--    net leaves the wallet with it. A rental piece still out releases the stock it held; stock quantities and the
--    inventory log stay as they are.
-- 3) 35 sample bookings a script made on 21/10 outside their court's opening hours are deleted (no money, reviews or
--    stock attached).
-- 4) Three bookings finished before "finish only when paid" (BK-0001, BK-0014, WI20260920074638842) were charged
--    commission as cash the court collected; they are recorded as paid in cash. The walk-in's open checkout gets the
--    matching cash payment so its bill shows nothing owed.
DO $$
DECLARE
  touched integer;
BEGIN
  -- 1a) Sample bookings back to their seed court.
  WITH seed(id, court_id) AS (VALUES
    ('b0002','c0002'), ('b0003','c0006'), ('b0006','c0003'), ('b0007','c0004'), ('b0008','c0011'), ('b0009','c0011'),
    ('b0010','c0012'), ('b0011','c0014'), ('b0012','c0016'), ('b0013','c0018'), ('b0014','c0020'), ('b0101','c0003'),
    ('b0102','c0004'), ('b0103','c0005'), ('b0104','c0006'), ('b0105','c0007'), ('b0106','c0008'), ('b0107','c0009'),
    ('b0108','c0010'), ('b0109','c0011'), ('b0110','c0012'), ('b0111','c0013'), ('b0112','c0014'), ('b0113','c0015'),
    ('b0114','c0016'), ('b0115','c0017'), ('b0116','c0018'), ('b0117','c0019'), ('b0118','c0020'), ('b0120','c0002')
  )
  UPDATE bookings b SET court_id = seed.court_id, court_surface_id = NULL, updated_at = now()
  FROM seed WHERE b.id = seed.id AND b.court_id = 'c0001';
  GET DIAGNOSTICS touched = ROW_COUNT;
  IF touched NOT IN (0, 30) THEN RAISE EXCEPTION 'sample bookings: expected 30 to move, got %', touched; END IF;

  UPDATE booking_slots s SET court_id = b.court_id, court_surface_id = NULL
  FROM bookings b
  WHERE s.booking_id = b.id AND b.id IN ('b0002','b0003','b0006','b0007','b0008','b0009','b0010','b0011','b0012','b0013','b0014',
    'b0101','b0102','b0103','b0104','b0105','b0106','b0107','b0108','b0109','b0110','b0111','b0112','b0113','b0114','b0115',
    'b0116','b0117','b0118','b0120')
    AND s.court_id <> b.court_id;
  GET DIAGNOSTICS touched = ROW_COUNT;
  IF touched NOT IN (0, 30) THEN RAISE EXCEPTION 'sample booking slots: expected 30 to move, got %', touched; END IF;

  -- 1b) Demand demo bookings back to the court their code names.
  UPDATE bookings SET court_id = substring(booking_code FROM '^BK-DEMAND-(c[0-9]{4})-'), court_surface_id = NULL, updated_at = now()
  WHERE booking_code LIKE 'BK-DEMAND-%' AND court_id = 'c0001'
    AND substring(booking_code FROM '^BK-DEMAND-(c[0-9]{4})-') IN ('c0003', 'c0021');
  GET DIAGNOSTICS touched = ROW_COUNT;
  IF touched NOT IN (0, 913) THEN RAISE EXCEPTION 'demand demo bookings: expected 913 to move, got %', touched; END IF;

  -- 2) + 3) The bookings to delete.
  CREATE TEMP TABLE doomed ON COMMIT DROP AS
    SELECT b.id, b.booking_order_id FROM bookings b
    WHERE b.court_id = 'c0001' AND b.booking_code ~ '^(CHECKIN-DEMO-|DEMO2607|POS-TEST-|TEST-|BK-TEST-)'
      AND NOT EXISTS (SELECT 1 FROM commission_transactions c WHERE c.booking_id = b.id);
  SELECT count(*) INTO touched FROM doomed;
  IF touched NOT IN (0, 26) THEN RAISE EXCEPTION 'test bookings: expected 26, got %', touched; END IF;

  INSERT INTO doomed
    SELECT b.id, b.booking_order_id FROM bookings b
    JOIN courts c ON c.id = b.court_id LEFT JOIN court_surfaces cs ON cs.id = b.court_surface_id
    WHERE b.booking_code ~ '^BK[0-9]{6}-C[0-9]{4}-' AND b.created_at::date = DATE '2026-10-21'
      AND b.booking_status::text IN ('PENDING','PENDING_PAYMENT','CONFIRMED','DEPOSIT_PAID','IN_PROGRESS','CHECKOUT_PENDING','COMPLETED')
      AND (b.end_time > coalesce(cs.closing_time, c.closing_time) OR b.start_time < coalesce(cs.opening_time, c.opening_time));
  GET DIAGNOSTICS touched = ROW_COUNT;
  IF touched NOT IN (0, 35) THEN RAISE EXCEPTION 'out-of-hours sample bookings: expected 35, got %', touched; END IF;

  IF EXISTS (SELECT 1 FROM payments WHERE booking_id IN (SELECT id FROM doomed))
     OR EXISTS (SELECT 1 FROM reviews WHERE booking_id IN (SELECT id FROM doomed))
     OR EXISTS (SELECT 1 FROM audit_logs WHERE entity_id IN (SELECT id FROM doomed))
     OR EXISTS (SELECT 1 FROM bookings WHERE booking_order_id IN (SELECT booking_order_id FROM doomed) AND id NOT IN (SELECT id FROM doomed)) THEN
    RAISE EXCEPTION 'a booking to delete has a payment, review, audit row or shares its order: stopping';
  END IF;

  -- Rental pieces still out on those bookings stop holding stock.
  UPDATE service_inventories si SET reserved_quantity = GREATEST(si.reserved_quantity - x.pieces, 0), updated_at = now()
  FROM (
    SELECT ri.service_id, count(*) AS pieces FROM rental_items ri JOIN booking_services bs ON bs.id = ri.booking_service_id
    WHERE bs.booking_id IN (SELECT id FROM doomed) AND ri.status = 'RENTED' GROUP BY ri.service_id
  ) x
  WHERE si.service_id = x.service_id;

  -- Settled platform money of those bookings leaves the wallet with its settlement.
  UPDATE partner_wallets w SET available_balance = w.available_balance - s.net, total_earned = w.total_earned - s.net, updated_at = now()
  FROM (
    SELECT partner_id, sum(net_amount) AS net FROM settlements
    WHERE booking_id IN (SELECT id FROM doomed) AND status = 'SETTLED' AND collected_by = 'PLATFORM' GROUP BY partner_id
  ) s
  WHERE w.partner_id = s.partner_id;
  IF (SELECT coalesce(sum(net_amount), 0) FROM settlements WHERE booking_id IN (SELECT id FROM doomed) AND status = 'SETTLED' AND collected_by = 'PLATFORM') <> 0
     OR EXISTS (SELECT 1 FROM settlements WHERE booking_id IN (SELECT id FROM doomed) AND (status NOT IN ('SETTLED', 'CANCELLED') OR collected_by <> 'PLATFORM')) THEN
    RAISE EXCEPTION 'settlements of the bookings to delete are not the expected ones: stopping';
  END IF;

  DELETE FROM settlements WHERE booking_id IN (SELECT id FROM doomed);
  DELETE FROM notifications WHERE metadata_json->>'bookingId' IN (SELECT id FROM doomed);
  -- Slots, service lines (and their rental pieces), checkouts (and their payments), vouchers and admin actions cascade.
  DELETE FROM bookings WHERE id IN (SELECT id FROM doomed);
  GET DIAGNOSTICS touched = ROW_COUNT;
  IF touched NOT IN (0, 61) THEN RAISE EXCEPTION 'bookings deleted: expected 61, got %', touched; END IF;
  DELETE FROM booking_orders WHERE id IN (SELECT booking_order_id FROM doomed WHERE booking_order_id IS NOT NULL);

  -- 4) Cash the court collected, recorded.
  UPDATE bookings SET payment_status = 'PAID', updated_at = now()
  WHERE id IN ('b0001', 'b0014', 'b0272') AND booking_status = 'COMPLETED' AND payment_status = 'UNPAID';
  GET DIAGNOSTICS touched = ROW_COUNT;
  IF touched NOT IN (0, 3) THEN RAISE EXCEPTION 'bookings marked paid: expected 3, got %', touched; END IF;

  INSERT INTO checkout_payments (checkout_id, amount, payment_method, transaction_id, status, paid_at)
  SELECT c.id, c.remaining_amount, 'CASH', 'REPAIR-20261029-CASH', 'PAID', now()
  FROM checkouts c WHERE c.booking_id = 'b0272' AND c.status = 'PENDING' AND c.remaining_amount > 0;
  UPDATE checkouts SET amount_paid = total_amount, remaining_amount = 0, status = 'COMPLETED', updated_at = now()
  WHERE booking_id = 'b0272' AND status = 'PENDING';

  -- 5) Decided next (the 18 test bookings that earned commission stay, the ledger being append-only): the same cash
  --    record for the other bookings finished unpaid before that rule. They had no deposit nor checkout, so each gets
  --    a settled checkout with the cash payment, as the cashier writes it, and its bill shows nothing owed.
  UPDATE bookings SET payment_status = 'PAID', updated_at = now()
  WHERE id IN ('b0201', 'b0206', 'bk3etiphngmsy2xh7d') AND booking_status = 'COMPLETED' AND payment_status = 'UNPAID';
  GET DIAGNOSTICS touched = ROW_COUNT;
  IF touched NOT IN (0, 3) THEN RAISE EXCEPTION 'later bookings marked paid: expected 3, got %', touched; END IF;

  IF EXISTS (SELECT 1 FROM booking_services WHERE booking_id IN ('b0201', 'b0206', 'bk3etiphngmsy2xh7d') AND coalesce(status, 'ACTIVE') = 'ACTIVE') THEN
    RAISE EXCEPTION 'a booking to record as paid has service lines: its bill needs the cashier, stopping';
  END IF;
  INSERT INTO checkouts (booking_id, subtotal_court, subtotal_service, discount, deposit_paid, amount_paid, remaining_amount, total_amount, status, notes)
  SELECT b.id, b.base_price + b.dynamic_adjustment_amount, 0, b.voucher_discount_amount, b.deposit_amount,
    b.base_price + b.dynamic_adjustment_amount - b.voucher_discount_amount, 0, b.base_price + b.dynamic_adjustment_amount - b.voucher_discount_amount,
    'COMPLETED', 'Ghi nhận đã thu tiền mặt (sửa dữ liệu 29/10)'
  FROM bookings b
  WHERE b.id IN ('b0201', 'b0206', 'bk3etiphngmsy2xh7d') AND b.deposit_amount = 0
    AND NOT EXISTS (SELECT 1 FROM checkouts c WHERE c.booking_id = b.id);
  INSERT INTO checkout_payments (checkout_id, amount, payment_method, transaction_id, status, paid_at)
  SELECT c.id, c.total_amount, 'CASH', 'REPAIR-20261029-CASH', 'PAID', now()
  FROM checkouts c
  WHERE c.booking_id IN ('b0201', 'b0206', 'bk3etiphngmsy2xh7d')
    AND NOT EXISTS (SELECT 1 FROM checkout_payments p WHERE p.checkout_id = c.id);
END $$;
