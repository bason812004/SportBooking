import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { disconnectSocket, getSocket } from "../lib/socket";
import { useAuth } from "../features/auth/hooks/useAuth";

export function useRealtime() {
  const { token, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket(isAuthenticated ? token : null);

    const invalidateBookings = () => {
      void queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["booking"] });
    };

    const invalidateAvailability = (payload?: { courtId?: string }) => {
      if (payload?.courtId) {
        void queryClient.invalidateQueries({ queryKey: ["weekly-schedule", payload.courtId] });
        void queryClient.invalidateQueries({ queryKey: ["court-availability", payload.courtId] });
        void queryClient.invalidateQueries({ queryKey: ["court", payload.courtId] });
      } else {
        void queryClient.invalidateQueries({ queryKey: ["weekly-schedule"] });
        void queryClient.invalidateQueries({ queryKey: ["court-availability"] });
        void queryClient.invalidateQueries({ queryKey: ["court"] });
      }
      void queryClient.invalidateQueries({ queryKey: ["courts"] });
      void queryClient.invalidateQueries({ queryKey: ["nearby-courts"] });
    };

    const invalidateNotifications = () => {
      void queryClient.invalidateQueries({ queryKey: ["my-notifications"] });
    };
    const invalidateBlogs = () => {
      void queryClient.invalidateQueries({ queryKey: ["public-blogs"] });
      void queryClient.invalidateQueries({ queryKey: ["public-blog"] });
      void queryClient.invalidateQueries({ queryKey: ["my-blogs"] });
      void queryClient.invalidateQueries({ queryKey: ["partner-blogs"] });
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
    socket.on("booking:confirmed", invalidateBookings);
    socket.on("court:availability-updated", invalidateAvailability);
    socket.on("court:availability:updated", invalidateAvailability);
    socket.on("court:booking-updated", invalidateAvailability);
    socket.on("court:updated", invalidateAvailability);
    socket.on("court:created", invalidateAvailability);
    socket.on("notification:new", invalidateNotifications);
    socket.on("blog:updated", invalidateBlogs);
    socket.on("connect", invalidateBlogs);
    if (socket.connected) invalidateBlogs();
    socket.on("connect", invalidateNotifications);
    if (socket.connected) invalidateNotifications();
    socket.on("settlement:updated", invalidateWalletData);
    socket.on("wallet:updated", invalidateWalletData);
    socket.on("withdrawal:created", invalidateWalletData);
    socket.on("withdrawal:updated", invalidateWalletData);

    return () => {
      socket.off("booking:created", invalidateBookings);
      socket.off("booking:status-updated", invalidateBookings);
      socket.off("booking:cancelled", invalidateBookings);
      socket.off("booking:confirmed", invalidateBookings);
      socket.off("court:availability-updated", invalidateAvailability);
      socket.off("court:availability:updated", invalidateAvailability);
      socket.off("court:booking-updated", invalidateAvailability);
      socket.off("court:updated", invalidateAvailability);
      socket.off("court:created", invalidateAvailability);
      socket.off("notification:new", invalidateNotifications);
      socket.off("blog:updated", invalidateBlogs);
      socket.off("connect", invalidateBlogs);
      socket.off("connect", invalidateNotifications);
      socket.off("settlement:updated", invalidateWalletData);
      socket.off("wallet:updated", invalidateWalletData);
      socket.off("withdrawal:created", invalidateWalletData);
      socket.off("withdrawal:updated", invalidateWalletData);
    };
  }, [isAuthenticated, queryClient, token]);
}

