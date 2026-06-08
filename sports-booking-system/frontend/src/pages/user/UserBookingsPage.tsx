import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { bookingApi } from "../../features/bookings/api/bookingApi";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";

export function UserBookingsPage() {
  const bookings = useQuery({ queryKey: ["my-bookings"], queryFn: bookingApi.listMine });

  if (bookings.isLoading) return <LoadingState />;
  if (bookings.isError) return <ErrorState message={bookings.error.message} />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Lich su dat san</h1>
      {bookings.data?.items.length === 0 && <EmptyState title="Ban chua co don dat san" />}
      <div className="overflow-hidden rounded-md border border-line bg-white">
        {bookings.data?.items.map((booking) => (
          <Link key={booking.id} to={`/user/bookings/${booking.id}`} className="grid gap-2 border-b border-line p-4 text-sm last:border-0 md:grid-cols-5">
            <span className="font-medium">{booking.bookingCode}</span>
            <span>{booking.court.name}</span>
            <span>{booking.bookingDate.slice(0, 10)}</span>
            <span>{booking.bookingStatus}</span>
            <span className="text-right font-medium">{Number(booking.totalPrice).toLocaleString("vi-VN")} VND</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
