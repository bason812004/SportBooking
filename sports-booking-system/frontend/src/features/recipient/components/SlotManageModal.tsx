import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { LayoutGrid, Lock, LockOpen, LogIn, LogOut, PhoneCall, User } from "lucide-react";
import { Overlay } from "../../../components/common/Overlay";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { recipientApi } from "../api/recipientApi";
import type { WeeklyScheduleSlot } from "../../../types/api";

type BookingAction = "confirm" | "reject" | "complete" | "no-show";

const bookingActionLabel: Record<BookingAction, string> = {
  confirm: "Xác nhận",
  reject: "Hủy/Từ chối",
  complete: "Hoàn thành",
  "no-show": "Khách không đến"
};

const bookingActionsForStatus = (status: string): BookingAction[] =>
  status === "PENDING" ? ["confirm", "reject"] : status === "CONFIRMED" ? ["complete", "no-show", "reject"] : [];

const bookingStatusMeta: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Chờ xác nhận", className: "bg-amber-100 text-amber-700" },
  CONFIRMED: { label: "Đã xác nhận", className: "bg-blue-100 text-blue-700" },
  COMPLETED: { label: "Hoàn thành", className: "bg-emerald-100 text-emerald-700" },
  CANCELLED: { label: "Đã huỷ", className: "bg-rose-100 text-rose-700" },
  NO_SHOW: { label: "Không đến", className: "bg-rose-100 text-rose-700" }
};

function minutesBetween(startTime: string, endTime: string) {
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const [endHours, endMinutes] = endTime.split(":").map(Number);
  return endHours * 60 + endMinutes - (startHours * 60 + startMinutes);
}

export function SlotManageModal({
  slot,
  courtSurfaceId,
  surfaceName,
  onClose,
  onChanged
}: {
  slot: WeeklyScheduleSlot;
  courtSurfaceId: string;
  surfaceName?: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [reason, setReason] = useState("");

  const onSuccess = (message: string) => {
    toast.success(message);
    onChanged();
    onClose();
  };
  const onError = (fallback: string) => (error: any) => toast.error(error.message || fallback);

  const statusMutation = useMutation({
    mutationFn: (action: BookingAction) => {
      const id = slot.bookingId!;
      if (action === "confirm") return recipientApi.confirmBooking(id);
      if (action === "reject") return recipientApi.rejectBooking(id);
      if (action === "complete") return recipientApi.completeBooking(id);
      return recipientApi.noShowBooking(id);
    },
    onSuccess: () => onSuccess("Đã cập nhật đơn đặt sân"),
    onError: onError("Có lỗi xảy ra")
  });

  const checkInMutation = useMutation({
    mutationFn: () => recipientApi.earlyCheckInBooking(slot.bookingId!),
    onSuccess: () => onSuccess("Đã check-in sớm"),
    onError: onError("Không thể check-in")
  });

  const checkOutMutation = useMutation({
    mutationFn: () => recipientApi.earlyCheckOutBooking(slot.bookingId!),
    onSuccess: () => onSuccess("Đã check-out"),
    onError: onError("Không thể check-out")
  });

  const lockMutation = useMutation({
    mutationFn: () =>
      recipientApi.lockSlot(courtSurfaceId, {
        bookingDate: slot.date,
        startTime: slot.startTime,
        minutes: minutesBetween(slot.startTime, slot.endTime),
        reason: reason.trim() || undefined
      }),
    onSuccess: () => onSuccess("Đã khoá khung giờ"),
    onError: onError("Không thể khoá khung giờ")
  });

  const unlockMutation = useMutation({
    mutationFn: () => recipientApi.unlockSlot(slot.blockId!),
    onSuccess: () => onSuccess("Đã mở khoá khung giờ"),
    onError: onError("Không thể mở khoá khung giờ")
  });

  const pending =
    statusMutation.isPending || checkInMutation.isPending || checkOutMutation.isPending || lockMutation.isPending || unlockMutation.isPending;

  return (
    <Overlay onClose={onClose}>
      <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          {slot.status === "BLOCKED" ? <LockOpen className="h-5 w-5" /> : slot.status === "BOOKED" ? <User className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-base font-black text-slate-800">
            {slot.startTime} - {slot.endTime}
          </h2>
          <p className="text-sm text-slate-500">{new Date(`${slot.date}T00:00:00`).toLocaleDateString("vi-VN")}</p>
          {surfaceName ? (
            <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-slate-400">
              <LayoutGrid className="h-3 w-3 shrink-0" />
              {surfaceName}
            </p>
          ) : null}
        </div>
      </div>

      {slot.status === "BOOKED" ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-slate-400 ring-1 ring-slate-200">
                <User className="h-4 w-4" />
              </span>
              <div>
                <p className="font-bold text-slate-800">{slot.customerName || "Khách vãng lai"}</p>
                {slot.customerPhone ? (
                  <p className="flex items-center gap-1 text-sm text-slate-500">
                    <PhoneCall className="h-3.5 w-3.5 shrink-0" />
                    {slot.customerPhone}
                  </p>
                ) : null}
              </div>
            </div>
            {slot.bookingStatus ? (
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  bookingStatusMeta[slot.bookingStatus]?.className ?? "bg-slate-100 text-slate-600"
                }`}
              >
                {bookingStatusMeta[slot.bookingStatus]?.label ?? slot.bookingStatus}
              </span>
            ) : null}
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-black uppercase tracking-wide text-slate-500">Thao tác tại sân</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={pending} onClick={() => checkInMutation.mutate()}>
                <LogIn className="h-4 w-4" />
                Check-in sớm
              </Button>
              <Button variant="secondary" disabled={pending} onClick={() => checkOutMutation.mutate()}>
                <LogOut className="h-4 w-4" />
                Check-out
              </Button>
            </div>
          </div>

          {slot.bookingStatus && bookingActionsForStatus(slot.bookingStatus).length > 0 ? (
            <div className="border-t border-slate-100 pt-3">
              <p className="mb-1.5 text-[11px] font-black uppercase tracking-wide text-slate-500">Cập nhật trạng thái đơn</p>
              <div className="flex flex-wrap gap-2">
                {bookingActionsForStatus(slot.bookingStatus).map((action) => (
                  <Button
                    key={action}
                    variant={action === "reject" || action === "no-show" ? "danger" : "secondary"}
                    disabled={pending}
                    onClick={() => statusMutation.mutate(action)}
                  >
                    {bookingActionLabel[action]}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : slot.status === "BLOCKED" ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Lý do khoá</p>
            <p className="mt-1 text-sm text-slate-700">{slot.blockReason || "Không có ghi chú"}</p>
          </div>
          <Button className="w-full" disabled={pending} onClick={() => unlockMutation.mutate()}>
            <LockOpen className="h-4 w-4" />
            Mở khoá khung giờ
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <Input label="Lý do khoá (tuỳ chọn)" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Bảo trì, dọn sân..." />
          </div>
          <Button className="w-full" variant="danger" disabled={pending} onClick={() => lockMutation.mutate()}>
            <Lock className="h-4 w-4" />
            Khoá khung giờ này
          </Button>
        </div>
      )}
    </Overlay>
  );
}
