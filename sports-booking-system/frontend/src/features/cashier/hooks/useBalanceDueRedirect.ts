import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

/**
 * Finishing a booking by hand (Hoàn thành, Check-out, Xác nhận trả sân) is refused while its bill still owes money
 * (error code BOOKING_BALANCE_DUE). This opens the cashier on that booking so the money is taken there; the cashier
 * finishes the booking once the bill is paid. Returns true when it handled the error.
 */
export function useBalanceDueRedirect(cashierPath: "/partner/cashier" | "/recipient/cashier") {
  const navigate = useNavigate();
  return (error: unknown, bookingId: string) => {
    const failure = error as { code?: string; message?: string } | null;
    if (failure?.code !== "BOOKING_BALANCE_DUE") return false;
    toast.info(failure.message || "Khách còn nợ tiền, hãy thu ở Thu ngân");
    navigate(`${cashierPath}?bookingId=${encodeURIComponent(bookingId)}`);
    return true;
  };
}
