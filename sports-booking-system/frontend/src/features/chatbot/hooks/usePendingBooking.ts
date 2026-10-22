import { useMutation, useQueryClient } from "@tanstack/react-query";
import { chatbotApi } from "../api/chatbotApi";

export function useConfirmPendingBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pendingBookingId: string) => chatbotApi.confirmBooking(pendingBookingId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    }
  });
}
