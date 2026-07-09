import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSocket } from "../lib/socket";
import { useAuth } from "../features/auth/hooks/useAuth";
import { voucherApi } from "../features/bookings/api/bookingApi";
import type { Voucher } from "../types/api";

const DISMISSED_KEY = "sportbooking:dismissed-voucher-popups";

function readDismissed() {
  try {
    return new Set<string>(JSON.parse(sessionStorage.getItem(DISMISSED_KEY) ?? "[]"));
  } catch {
    return new Set<string>();
  }
}

function writeDismissed(ids: Set<string>) {
  sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(ids)));
}

function isVoucherAvailable(voucher: Voucher) {
  if (new Date(voucher.endDate).getTime() <= Date.now()) return false;
  if (voucher.usageLimit != null && voucher.usedCount >= voucher.usageLimit) return false;
  return voucher.status === "ACTIVE";
}

export function useVoucherPopup() {
  const { token, isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();
  const [pendingVoucher, setPendingVoucher] = useState<Voucher | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => readDismissed());
  const [initialPopupChecked, setInitialPopupChecked] = useState(false);
  const canShowPopup = isAuthenticated && user?.role === "USER";

  const activeVouchers = useQuery({
    queryKey: ["active-vouchers"],
    queryFn: voucherApi.list,
    enabled: canShowPopup,
    staleTime: 60_000
  });

  const myVouchers = useQuery({
    queryKey: ["my-vouchers"],
    queryFn: voucherApi.myVouchers,
    enabled: canShowPopup,
    staleTime: 30_000
  });

  const claimedIds = useMemo(() => new Set((myVouchers.data ?? []).map((voucher) => voucher.id)), [myVouchers.data]);

  const claimMutation = useMutation({
    mutationFn: (voucherId: string) => voucherApi.claim(voucherId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["active-vouchers"] });
      toast.success("Nhận voucher thành công!");
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ["my-vouchers"] });
      toast.error(error.message || "Không thể nhận voucher.");
    }
  });

  useEffect(() => {
    if (!canShowPopup) {
      setInitialPopupChecked(false);
      setPendingVoucher(null);
      setModalOpen(false);
    }
  }, [canShowPopup]);

  const rememberDismissed = useCallback((voucherId: string) => {
    setDismissedIds((current) => {
      const next = new Set(current);
      next.add(voucherId);
      writeDismissed(next);
      return next;
    });
  }, []);

  const showVoucher = useCallback(
    (voucher: Voucher) => {
      if (!canShowPopup) return;
      if (!isVoucherAvailable(voucher)) return;
      if (claimedIds.has(voucher.id)) return;
      if (dismissedIds.has(voucher.id)) return;
      setPendingVoucher(voucher);
      setModalOpen(true);
    },
    [canShowPopup, claimedIds, dismissedIds]
  );

  async function handleClaim(voucherId: string) {
    await claimMutation.mutateAsync(voucherId);
  }

  function handleClose() {
    if (pendingVoucher) rememberDismissed(pendingVoucher.id);
    setModalOpen(false);
    setPendingVoucher(null);
  }

  useEffect(() => {
    if (!canShowPopup || modalOpen || pendingVoucher || initialPopupChecked) return;
    if (activeVouchers.isLoading || myVouchers.isLoading) return;
    const firstUnclaimed = (activeVouchers.data ?? []).find(
      (voucher) => isVoucherAvailable(voucher) && !claimedIds.has(voucher.id) && !dismissedIds.has(voucher.id)
    );
    setInitialPopupChecked(true);
    if (firstUnclaimed) showVoucher(firstUnclaimed);
  }, [
    activeVouchers.data,
    activeVouchers.isLoading,
    canShowPopup,
    claimedIds,
    dismissedIds,
    initialPopupChecked,
    modalOpen,
    myVouchers.isLoading,
    pendingVoucher,
    showVoucher
  ]);

  useEffect(() => {
    if (!canShowPopup || !token) return;

    const socket = getSocket(token);

    function handleVoucherNew(voucher: Voucher) {
      queryClient.invalidateQueries({ queryKey: ["active-vouchers"] });
      if (claimedIds.has(voucher.id)) return;
      showVoucher(voucher);
    }

    socket.on("voucher:new", handleVoucherNew);
    return () => {
      socket.off("voucher:new", handleVoucherNew);
    };
  }, [canShowPopup, claimedIds, queryClient, showVoucher, token]);

  return {
    pendingVoucher,
    modalOpen,
    onClose: handleClose,
    onClaim: handleClaim
  };
}
