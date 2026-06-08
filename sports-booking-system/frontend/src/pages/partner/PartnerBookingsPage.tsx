import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { partnerApi } from "../../features/partner/api/partnerApi";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";

export function PartnerBookingsPage() {
  const queryClient = useQueryClient();
  const bookings = useQuery({ queryKey: ["partner-bookings"], queryFn: partnerApi.bookings });
  const status = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "confirm" | "reject" | "complete" | "no-show" }) => partnerApi.setBookingStatus(id, action),
    onSuccess: () => {
      toast.success("Da cap nhat don");
      queryClient.invalidateQueries({ queryKey: ["partner-bookings"] });
    },
    onError: (error) => toast.error(error.message)
  });

  if (bookings.isLoading) return <LoadingState />;
  if (bookings.isError) return <ErrorState message={bookings.error.message} />;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Don dat san</h1>
      {bookings.data?.items.length === 0 && <EmptyState title="Chua co don" />}
      <div className="overflow-auto rounded-md border border-line bg-white">
        <table className="w-full min-w-[780px] text-sm">
          <tbody>
            {bookings.data?.items.map((booking) => (
              <tr key={booking.id} className="border-b border-line last:border-0">
                <td className="p-3 font-medium">{booking.bookingCode}</td>
                <td className="p-3">{booking.court.name}</td>
                <td className="p-3">{booking.bookingStatus}</td>
                <td className="p-3 text-right">{Number(booking.totalPrice).toLocaleString("vi-VN")} VND</td>
                <td className="flex gap-2 p-3">
                  {(["confirm", "complete", "no-show", "reject"] as const).map((action) => (
                    <Button key={action} variant="secondary" onClick={() => status.mutate({ id: booking.id, action })}>{action}</Button>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
