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

    socket.on("booking:created", invalidateBookings);
    socket.on("booking:status-updated", invalidateBookings);
    socket.on("booking:cancelled", invalidateBookings);
    socket.on("court:availability-updated", invalidateAvailability);
    socket.on("notification:new", invalidateNotifications);

    return () => {
      socket.off("booking:created", invalidateBookings);
      socket.off("booking:status-updated", invalidateBookings);
      socket.off("booking:cancelled", invalidateBookings);
      socket.off("court:availability-updated", invalidateAvailability);
      socket.off("notification:new", invalidateNotifications);
    };
  }, [isAuthenticated, queryClient, token]);
}
