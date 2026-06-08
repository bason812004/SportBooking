import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { bookingApi } from "../../features/bookings/api/bookingApi";
import { LoadingState, ErrorState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";

export function UserBookingDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const booking = useQuery({ queryKey: ["booking", id], queryFn: () => bookingApi.detail(id!), enabled: Boolean(id) });
  const cancel = useMutation({
    mutationFn: () => bookingApi.cancel(id!, "Nguoi dung huy"),
    onSuccess: () => {
      toast.success("Da huy don");
      queryClient.invalidateQueries({ queryKey: ["booking", id] });
    },
    onError: (error) => toast.error(error.message)
  });

  if (booking.isLoading) return <LoadingState />;
  if (booking.isError) return <ErrorState message={booking.error.message} />;

  return (
    <div className="rounded-md border border-line bg-white p-5">
      <h1 className="text-2xl font-semibold">{booking.data?.bookingCode}</h1>
      <p className="mt-2 text-slate-600">{booking.data?.court.name}</p>
      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <span>Ngay: {booking.data?.bookingDate.slice(0, 10)}</span>
        <span>Trang thai: {booking.data?.bookingStatus}</span>
        <span>Thanh toan: {booking.data?.paymentMethod}</span>
        <span>Tong tien: {Number(booking.data?.totalPrice ?? 0).toLocaleString("vi-VN")} VND</span>
      </div>
      <Button className="mt-5" variant="danger" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
        Huy don
      </Button>
    </div>
  );
}
