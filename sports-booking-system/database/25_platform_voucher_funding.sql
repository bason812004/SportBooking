-- Vouchers an admin issues (partner_id is null) are funded entirely by the platform: the partner whose court is booked
-- still earns the full court price, the platform pays its share of the discount back when the booking is completed
-- (settlement.service chargePartnerCollected). Before this, admin vouchers kept the column default PARTNER 100%.
-- New admin vouchers are created as PLATFORM by the backend; this fixes the ones that already exist.
-- Bookings already made keep the split recorded on booking_vouchers at the time (none used an admin voucher when this
-- was written). Safe to run more than once.
UPDATE vouchers
SET funded_by = 'PLATFORM'::voucher_funded_by,
    partner_funding_percent = 0,
    platform_funding_percent = 100,
    updated_at = now()
WHERE partner_id IS NULL
  AND (funded_by <> 'PLATFORM'::voucher_funded_by OR partner_funding_percent <> 0 OR platform_funding_percent <> 100);
