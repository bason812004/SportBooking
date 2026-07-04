import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { recipientApi } from "../../features/recipient/api/recipientApi";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { ConfirmModal } from "../../components/common/ConfirmModal";

type Action = "confirm" | "reject" | "complete" | "no-show";

export function RecipientBookingsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: "", fromDate: "", toDate: "" });
  const [confirm, setConfirm] = useState<{ id: string; action: Action } | null>(null);

  const bookings = useQuery({
    queryKey: ["recipient-bookings", page, filters],
    queryFn: () => recipientApi.bookings({ page, limit: 10, ...filters })
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: Action }) => {
      if (action === "confirm") return recipientApi.confirmBooking(id);
      if (action === "reject") return recipientApi.rejectBooking(id);
      if (action === "complete") return recipientApi.completeBooking(id);
      return recipientApi.noShowBooking(id);
    },
    onSuccess: () => {
      toast.success("Đã cập nhật đơn đặt sân");
      setConfirm(null);
      queryClient.invalidateQueries({ queryKey: ["recipient-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["recipient-dashboard"] });
    },
    onError: (error: any) => toast.error(error.message || "Có lỗi xảy ra")
  });

  if (bookings.isLoading) return <LoadingState />;
  if (bookings.isError) return <ErrorState message={bookings.error.message} />;

  const actionLabel: Record<Action, string> = {
    confirm: "Xác nhận",
    reject: "Hủy/Từ chối",
    complete: "Hoàn thành",
    "no-show": "Khách không đến"
  };

  const run = (id: string, action: Action) => {
    if (action === "reject" || action === "no-show") {
      setConfirm({ id, action });
    } else {
      statusMutation.mutate({ id, action });
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Quản lý Đơn đặt sân</h1>
        <p className="text-slate-600">Theo dõi, lọc và xử lý các booking cho sân của bạn.</p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <Select
          label="Trạng thái"
          value={filters.status}
          onChange={(e) => {
            setPage(1);
            setFilters({ ...filters, status: e.target.value });
          }}
          options={[
            { value: "", label: "Tất cả trạng thái" },
            ...["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"].map((val) => ({ value: val, label: val }))
          ]}
        />
        <Input
          label="Từ ngày"
          type="date"
          value={filters.fromDate}
          onChange={(e) => {
            setPage(1);
            setFilters({ ...filters, fromDate: e.target.value });
          }}
        />
        <Input
          label="Đến ngày"
          type="date"
          value={filters.toDate}
          onChange={(e) => {
            setPage(1);
            setFilters({ ...filters, toDate: e.target.value });
          }}
        />
      </div>

      {bookings.data?.items.length === 0 ? (
        <EmptyState title="Không tìm thấy đơn đặt sân nào" />
      ) : (
        <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[1050px] text-sm text-left">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-3 font-semibold text-slate-600">Khách hàng</th>
                <th className="p-3 font-semibold text-slate-600">Số điện thoại</th>
                <th className="p-3 font-semibold text-slate-600">Ngày chơi</th>
                <th className="p-3 font-semibold text-slate-600">Thời gian</th>
                <th className="p-3 font-semibold text-slate-600">Thanh toán</th>
                <th className="p-3 font-semibold text-slate-600">Trạng thái</th>
                <th className="p-3 font-semibold text-slate-600 text-right">Tổng cộng</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {bookings.data?.items.map((booking) => (
                <tr key={booking.id} className="border-t hover:bg-slate-50">
                  <td className="p-3 font-medium text-slate-800">{booking.user?.fullName}</td>
                  <td className="p-3 text-slate-600">{booking.user?.phone || "Chưa cung cấp"}</td>
                  <td className="p-3 text-slate-600">{new Date(booking.bookingDate).toLocaleDateString("vi-VN")}</td>
                  <td className="p-3 text-slate-600">{`${booking.startTime.slice(11, 16)} - ${booking.endTime.slice(11, 16)}`}</td>
                  <td className="p-3 text-slate-600">{booking.paymentStatus}</td>
                  <td className="p-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      booking.bookingStatus === "CONFIRMED" ? "bg-blue-100 text-blue-800" :
                      booking.bookingStatus === "PENDING" ? "bg-yellow-100 text-yellow-800" :
                      booking.bookingStatus === "COMPLETED" ? "bg-green-100 text-green-800" :
                      "bg-red-100 text-red-800"
                    }`}>
                      {booking.bookingStatus}
                    </span>
                  </td>
                  <td className="p-3 text-right font-semibold text-slate-800">{Number(booking.totalPrice).toLocaleString("vi-VN")} đ</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      {(booking.bookingStatus === "PENDING"
                        ? ["confirm", "reject"]
                        : booking.bookingStatus === "CONFIRMED"
                        ? ["complete", "no-show", "reject"]
                        : []
                      ).map((action) => (
                        <Button
                          key={action}
                          variant={action === "reject" || action === "no-show" ? "danger" : "secondary"}
                          disabled={statusMutation.isPending}
                          onClick={() => run(booking.id, action as Action)}
                        >
                          {actionLabel[action as Action]}
                        </Button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {bookings.data && bookings.data.meta.totalPages > 1 && (
        <div className="flex items-center justify-end gap-3 mt-4">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Trang trước
          </Button>
          <span className="text-sm font-medium">
            Trang {bookings.data.meta.page}/{bookings.data.meta.totalPages}
          </span>
          <Button variant="secondary" disabled={page >= bookings.data.meta.totalPages} onClick={() => setPage(page + 1)}>
            Trang sau
          </Button>
        </div>
      )}

      <ConfirmModal
        open={Boolean(confirm)}
        title={confirm?.action === "no-show" ? "Xác nhận khách không đến" : "Xác nhận hủy đơn"}
        message={
          confirm?.action === "no-show"
            ? "Thao tác này xác nhận khách hàng không đến nhận sân và sẽ xử lý cọc nếu có."
            : "Đơn đặt sân sẽ bị hủy bỏ và không thể hoàn tác."
        }
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && statusMutation.mutate(confirm)}
      />
    </div>
  );
}
