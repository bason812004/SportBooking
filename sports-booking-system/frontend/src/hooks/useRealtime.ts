import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { disconnectSocket, getSocket } from "../lib/socket";
import { useAuth } from "../features/auth/hooks/useAuth";

export function useRealtime() {
  const { token, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated || !token) {
      disconnectSocket();
      return undefined;
    }

    const socket = getSocket(token);
    const invalidateBookings = () => {
      void queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["booking"] });
    };
    const invalidateAvailability = () => {
      void queryClient.invalidateQueries({ queryKey: ["court-availability"] });
      void queryClient.invalidateQueries({ queryKey: ["courts"] });
    };
    const invalidateNotifications = () => {
      void queryClient.invalidateQueries({ queryKey: ["my-notifications"] });
    };
    const invalidateWalletData = () => {
      void queryClient.invalidateQueries({ queryKey: ["partner-wallet"] });
      void queryClient.invalidateQueries({ queryKey: ["partner-settlements"] });
      void queryClient.invalidateQueries({ queryKey: ["partner-withdrawals"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-settlements"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-settlements-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-withdrawals-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-wallets"] });
    };

    socket.on("booking:created", invalidateBookings);
    socket.on("booking:status-updated", invalidateBookings);
    socket.on("booking:cancelled", invalidateBookings);
    socket.on("court:availability-updated", invalidateAvailability);
    socket.on("notification:new", invalidateNotifications);
    socket.on("settlement:updated", invalidateWalletData);
    socket.on("wallet:updated", invalidateWalletData);
    socket.on("withdrawal:created", invalidateWalletData);
    socket.on("withdrawal:updated", invalidateWalletData);

    return () => {
      socket.off("booking:created", invalidateBookings);
      socket.off("booking:status-updated", invalidateBookings);
      socket.off("booking:cancelled", invalidateBookings);
      socket.off("court:availability-updated", invalidateAvailability);
      socket.off("notification:new", invalidateNotifications);
      socket.off("settlement:updated", invalidateWalletData);
      socket.off("wallet:updated", invalidateWalletData);
      socket.off("withdrawal:created", invalidateWalletData);
      socket.off("withdrawal:updated", invalidateWalletData);
    };
  }, [isAuthenticated, queryClient, token]);
}
