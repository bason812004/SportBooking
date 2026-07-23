import { useMutation, useQuery } from "@tanstack/react-query";
import { voucherApi } from "../api/bookingApi";
import { contentApi } from "../../content/api/contentApi";
import type { Voucher, VoucherEligibilityResult, VoucherEligibilityResponse, VoucherValidatePayload } from "../../../types/api";

export function useActiveVouchers() {
  return useQuery({ queryKey: ["active-vouchers"], queryFn: voucherApi.list, staleTime: 60_000 });
}

export function useMyVouchers() {
  return useQuery({
    queryKey: ["my-vouchers"],
    queryFn: voucherApi.myVouchers,
    staleTime: 30_000
  });
}

export function useValidateVoucher() {
  return useMutation({ mutationFn: (payload: VoucherValidatePayload) => voucherApi.validate(payload) });
}

/**
 * Live eligibility check against the currently selected court/date/time
 * and the latest known subtotal. Returns null when no slot has been
 * chosen yet.
 *
 * Returns a grouped response: { bestVoucher, availableVouchers, unavailableVouchers }
 */
export function useVoucherEligibility(input: {
  courtId?: string;
  bookingDate?: string;
  startTime?: string;
  endTime?: string;
  subtotal?: number;
  enabled?: boolean;
}) {
  return useQuery<VoucherEligibilityResponse | null>({
    queryKey: ["voucher-eligibility", input],
    queryFn: () =>
      contentApi.checkVoucherEligibility({
        courtId: input.courtId!,
        bookingDate: input.bookingDate!,
        startTime: input.startTime!,
        endTime: input.endTime!,
        subtotal: input.subtotal ?? 0
      }),
    enabled:
      Boolean(input.enabled ?? true) &&
      Boolean(input.courtId) &&
      Boolean(input.bookingDate) &&
      Boolean(input.startTime) &&
      Boolean(input.endTime),
    staleTime: 30_000
  });
}