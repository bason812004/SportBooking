import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { partnerApi } from "../../features/partner/api/partnerApi";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { ConfirmModal } from "../../components/common/ConfirmModal";

type Action = "confirm" | "reject" | "complete" | "no-show";

export function PartnerBookingsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ courtId: "", status: "", fromDate: "", toDate: "" });
  const [confirm, setConfirm] = useState<{ id: string; action: Action } | null>(null);
  const courts = useQuery({ queryKey: ["partner-courts"], queryFn: partnerApi.courts });
  const bookings = useQuery({
    queryKey: ["partner-bookings", page, filters],
    queryFn: () => partnerApi.bookings({ page, limit: 10, ...filters })
  });
  const status = useMutation({
    mutationFn: ({ id, action }: { id: string; action: Action }) => partnerApi.setBookingStatus(id, action),
    onSuccess: () => {
      toast.success("Đã cập nhật đơn");
      setConfirm(null);
      queryClient.invalidateQueries({ queryKey: ["partner-bookings"] });
    },
    onError: (error) => toast.error(error.message)
  });

  if (bookings.isLoading) return <LoadingState />;
  if (bookings.isError) return <ErrorState message={bookings.error.message} />;
  const actionLabel: Record<Action, string> = { confirm: "Xác nhận", reject: "Từ chối/Hủy", complete: "Hoàn thành", "no-show": "Khách không đến" };
  const run = (id: string, action: Action) => action === "reject" || action === "no-show" ? setConfirm({ id, action }) : status.mutate({ id, action });

  return (
    <div className="space-y-5">
      <div><h1 className="text-3xl font-bold">Đơn đặt sân</h1><p className="text-slate-600">Lọc và xử lý booking theo từng sân, ngày và trạng thái.</p></div>
      <div className="grid gap-3 rounded-2xl border border-line bg-white p-4 md:grid-cols-4">
        <Select label="Sân" value={filters.courtId} onChange={(e) => { setPage(1); setFilters({ ...filters, courtId: e.target.value }); }} options={[{ value: "", label: "Tất cả sân" }, ...(courts.data?.map(c => ({ value: c.id, label: c.name })) ?? [])]} />
        <Select label="Trạng thái" value={filters.status} onChange={(e) => { setPage(1); setFilters({ ...filters, status: e.target.value }); }} options={[{ value: "", label: "Tất cả" }, ...["PENDING","CONFIRMED","COMPLETED","CANCELLED","NO_SHOW"].map(value => ({ value, label: value }))]} />
        <Input label="Từ ngày" type="date" value={filters.fromDate} onChange={(e) => { setPage(1); setFilters({ ...filters, fromDate: e.target.value }); }} />
        <Input label="Đến ngày" type="date" value={filters.toDate} onChange={(e) => { setPage(1); setFilters({ ...filters, toDate: e.target.value }); }} />
      </div>
      {bookings.data?.items.length === 0 && <EmptyState title="Chưa có đơn phù hợp" />}
      <div className="overflow-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[1050px] text-sm">
          <thead className="bg-slate-50 text-left"><tr><th className="p-3">Mã</th><th>Khách hàng</th><th>Sân</th><th>Ngày giờ</th><th>Thanh toán</th><th>Trạng thái</th><th className="text-right">Tổng tiền</th><th></th></tr></thead>
          <tbody>{bookings.data?.items.map((booking) => (
            <tr key={booking.id} className="border-t">
              <td className="p-3 font-medium">{booking.bookingCode}</td>
              <td>{booking.user?.fullName}<br/><span className="text-xs text-slate-500">{booking.user?.phone}</span></td>
              <td>{booking.court.name}</td>
              <td>{new Date(booking.bookingDate).toLocaleDateString("vi-VN")}<br/>{booking.startTime.slice(11,16)}-{booking.endTime.slice(11,16)}</td>
              <td>{booking.paymentStatus}</td><td>{booking.bookingStatus}</td>
              <td className="text-right">{Number(booking.totalPrice).toLocaleString("vi-VN")} đ</td>
              <td className="p-3"><div className="flex gap-2">
                {(booking.bookingStatus === "PENDING" ? ["confirm","reject"] : booking.bookingStatus === "CONFIRMED" ? ["complete","no-show","reject"] : []).map(action => <Button key={action} variant={action === "reject" || action === "no-show" ? "danger" : "secondary"} disabled={status.isPending} onClick={() => run(booking.id, action as Action)}>{actionLabel[action as Action]}</Button>)}
              </div></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-3"><Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trang trước</Button><span>Trang {bookings.data?.meta.page}/{Math.max(bookings.data?.meta.totalPages ?? 1, 1)}</span><Button variant="secondary" disabled={page >= (bookings.data?.meta.totalPages ?? 1)} onClick={() => setPage(page + 1)}>Trang sau</Button></div>
      <ConfirmModal open={Boolean(confirm)} title={confirm?.action === "no-show" ? "Xác nhận khách không đến" : "Xác nhận hủy đơn"} message={confirm?.action === "no-show" ? "Thao tác này tạo hoa hồng trên tiền cọc và không thể hoàn tác." : "Đơn sẽ bị hủy và áp dụng chính sách hoàn tiền."} onCancel={() => setConfirm(null)} onConfirm={() => confirm && status.mutate(confirm)} />
    </div>
  );
}
