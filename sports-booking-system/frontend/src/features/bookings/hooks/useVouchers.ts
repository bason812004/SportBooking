import { useMutation, useQuery } from "@tanstack/react-query";
import { voucherApi } from "../api/bookingApi";
import type { VoucherValidatePayload } from "../../../types/api";

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