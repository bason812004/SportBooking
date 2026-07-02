import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSocket } from "../lib/socket";
import { useAuth } from "../features/auth/hooks/useAuth";
import { voucherApi } from "../features/bookings/api/bookingApi";
import type { Voucher } from "../types/api";

export function useVoucherPopup() {
  const { token, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [pendingVoucher, setPendingVoucher] = useState<Voucher | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const myVouchers = useQuery({
    queryKey: ["my-vouchers"],
    queryFn: voucherApi.myVouchers,
    enabled: isAuthenticated
  });

  const claimMutation = useMutation({
    mutationFn: (voucherId: string) => voucherApi.claim(voucherId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-vouchers"] });
      toast.success("Nhận voucher thành công!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Không thể nhận voucher.");
    }
  });

  async function handleClaim(voucherId: string) {
    await claimMutation.mutateAsync(voucherId);
  }

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const socket = getSocket(token);

    function handleVoucherNew(voucher: Voucher) {
      const alreadyClaimed = (myVouchers.data ?? []).some((v) => v.id === voucher.id);
      if (alreadyClaimed) return;
      setPendingVoucher(voucher);
      setModalOpen(true);
    }

    socket.on("voucher:new", handleVoucherNew);
    return () => {
      socket.off("voucher:new", handleVoucherNew);
    };
  }, [isAuthenticated, token, myVouchers.data]);

  return {
    pendingVoucher,
    modalOpen,
    setModalOpen,
    onClaim: handleClaim
  };
}
