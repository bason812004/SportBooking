import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { bookingApi } from "../../features/bookings/api/bookingApi";
import { LoadingState, ErrorState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";

export function PaymentPage() {
  const { bookingId } = useParams();
  const booking = useQuery({ queryKey: ["booking", bookingId], queryFn: () => bookingApi.detail(bookingId!), enabled: Boolean(bookingId) });

  if (booking.isLoading) return <LoadingState />;
  if (booking.isError) return <ErrorState message={booking.error.message} />;

  return (
    <div className="mx-auto max-w-xl rounded-md border border-line bg-white p-6 text-center shadow-sm">
      <CheckCircle2 className="mx-auto h-12 w-12 text-court" />
      <h1 className="mt-3 text-2xl font-semibold">Don dat san da duoc tao</h1>
      <p className="mt-2 text-slate-600">Ma don: {booking.data?.bookingCode}</p>
      <p className="mt-1 text-xl font-semibold text-court">{Number(booking.data?.totalPrice ?? 0).toLocaleString("vi-VN")} VND</p>
      <Link className="mt-5 inline-block" to="/user/bookings">
        <Button>Xem lich su dat san</Button>
      </Link>
    </div>
  );
}
