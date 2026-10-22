import { AppRoutes } from "../routes/AppRoutes";
import { useRealtime } from "../hooks/useRealtime";
import { ClaimVoucherModal } from "../components/common/ClaimVoucherModal";
import { useVoucherPopup } from "../hooks/useVoucherPopup";
import { BookingProvider } from "../context/BookingContext";

export function App() {
  useRealtime();
  const { pendingVoucher, modalOpen, onClose, onClaim } = useVoucherPopup();
  return (
    <BookingProvider>
      <AppRoutes />
      <ClaimVoucherModal
        voucher={pendingVoucher}
        open={modalOpen}
        onClaim={onClaim}
        onClose={onClose}
      />
    </BookingProvider>
  );
}
