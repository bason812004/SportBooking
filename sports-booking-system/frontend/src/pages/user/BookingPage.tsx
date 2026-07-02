import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ErrorState, LoadingState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { bookingApi, type BookingSlotPayload } from "../../features/bookings/api/bookingApi";
import { courtApi } from "../../features/courts/api/courtApi";

function money(value: number) {
  return `${value.toLocaleString("vi-VN")} VND`;
}

function parseSlots(values: string[]): BookingSlotPayload[] {
  return values
    .map((value) => {
      const [startTime, endTime] = value.split("-");
      return startTime && endTime ? { startTime, endTime } : null;
    })
    .filter((slot): slot is BookingSlotPayload => Boolean(slot));
}

export function BookingPage() {
  const { courtId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bookingDate = searchParams.get("date") ?? "";
  const selectedSlots = useMemo(() => parseSlots(searchParams.getAll("slot")), [searchParams]);
  const court = useQuery({
    queryKey: ["court-detail", courtId],
    queryFn: () => courtApi.detail(courtId!),
    enabled: Boolean(courtId)
  });
  const [courtSurfaceId, setCourtSurfaceId] = useState("");
  const selectedSurfaceId = courtSurfaceId || court.data?.surfaces?.[0]?.id || undefined;
  const [voucherCode, setVoucherCode] = useState("");
  const [note, setNote] = useState("");
  const [paymentType, setPaymentType] = useState<"DEPOSIT" | "FULL_PAYMENT">("DEPOSIT");

  const quotePayload = courtId && bookingDate && selectedSlots.length
    ? { courtId, courtSurfaceId: selectedSurfaceId, bookingDate, slots: selectedSlots, voucherCode: voucherCode || undefined }
    : null;

  const quote = useQuery({
    queryKey: ["booking-quote", quotePayload],
    queryFn: () => bookingApi.quote(quotePayload!),
    enabled: Boolean(quotePayload)
  });

  const checkout = useMutation({
    mutationFn: () =>
      bookingApi.checkout({
        courtId: courtId!,
        courtSurfaceId: selectedSurfaceId,
        bookingDate,
        slots: selectedSlots,
        voucherCode: voucherCode || undefined,
        paymentType,
        note: note || undefined
      }),
    onSuccess: (result) => {
      toast.success("Đã tạo thanh toán. Vui lòng quét mã QR để hoàn tất.");
      navigate(`/payment/${result.paymentId}`);
    },
    onError: (error) => toast.error(error.message)
  });

  if (!courtId || !bookingDate || !selectedSlots.length) {
    return <ErrorState message="Vui lòng chọn sân, ngày và khung giờ từ trang chi tiết sân." />;
  }
  if (quote.isLoading || court.isLoading) return <LoadingState />;
  if (quote.isError) return <ErrorState message={quote.error.message} />;
  if (court.isError) return <ErrorState message={court.error.message} />;
  if (!quote.data) return <ErrorState message="Không thể tạo báo giá đặt sân." />;

  const paymentAmount = paymentType === "DEPOSIT" ? quote.data.minimumDepositAmount : quote.data.totalAmount;

  return (
    <div className="mx-auto grid max-w-5xl gap-5 px-4 md:grid-cols-[1fr_360px]">
      <section className="rounded-md border border-line bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold">Thông tin đặt sân</h1>
        <div className="mt-5 flex gap-4">
          {quote.data.court.imageUrl ? <img src={quote.data.court.imageUrl} alt={quote.data.court.name} className="h-24 w-32 rounded-md object-cover" /> : null}
          <div>
            <h2 className="text-xl font-semibold">{quote.data.court.name}</h2>
            <p className="mt-1 text-sm text-slate-600">{quote.data.court.address}</p>
            <p className="mt-2 font-medium">Ngày đặt: {quote.data.bookingDate}</p>
            {quote.data.courtSurface && <p className="mt-1 text-sm font-bold text-emerald-700">San con: {quote.data.courtSurface.name}</p>}
          </div>
        </div>

        {court.data?.surfaces?.length ? (
          <div className="mt-6">
            <Select
              label="Chon san con"
              value={selectedSurfaceId ?? ""}
              onChange={(event) => setCourtSurfaceId(event.target.value)}
              options={court.data.surfaces.map((surface) => ({
                value: surface.id,
                label: `${surface.name}${surface.code ? ` (${surface.code})` : ""}`
              }))}
            />
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          <h3 className="font-semibold">Khung giờ đã chọn</h3>
          {quote.data.slots.map((slot) => (
            <div key={`${slot.startTime}-${slot.endTime}`} className="flex justify-between rounded-md border border-line bg-slate-50 p-3">
              <span>{slot.startTime} - {slot.endTime}</span>
              <span className="font-semibold">{money(slot.price)}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Input label="Mã voucher" value={voucherCode} onChange={(event) => setVoucherCode(event.target.value.toUpperCase())} onBlur={() => quote.refetch()} />
          <Input label="Ghi chú đặt sân" value={note} onChange={(event) => setNote(event.target.value)} />
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setPaymentType("DEPOSIT")}
            className={`rounded-md border p-4 text-left ${paymentType === "DEPOSIT" ? "border-[#0f766e] bg-emerald-50" : "border-line bg-white"}`}
          >
            <span className="block font-semibold">Cọc tối thiểu 50%</span>
            <span className="mt-1 block text-sm text-slate-600">{money(quote.data.minimumDepositAmount)}</span>
          </button>
          <button
            type="button"
            onClick={() => setPaymentType("FULL_PAYMENT")}
            className={`rounded-md border p-4 text-left ${paymentType === "FULL_PAYMENT" ? "border-[#0f766e] bg-emerald-50" : "border-line bg-white"}`}
          >
            <span className="block font-semibold">Thanh toán toàn bộ</span>
            <span className="mt-1 block text-sm text-slate-600">{money(quote.data.totalAmount)}</span>
          </button>
        </div>
      </section>

      <aside className="h-max rounded-md border border-line bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Tổng thanh toán</h2>
        <div className="mt-4 space-y-2 text-sm">
          <Row label="Số giờ đã chọn" value={`${quote.data.slots.length} khung giờ`} />
          <Row label="Tạm tính" value={money(quote.data.subtotal)} />
          <Row label="Giảm giá voucher" value={money(quote.data.voucherDiscountAmount)} />
          <Row label="Tổng tiền" value={money(quote.data.totalAmount)} />
          <Row label="Tiền cần thanh toán" value={money(paymentAmount)} strong />
          <Row label="Còn lại" value={money(quote.data.totalAmount - paymentAmount)} />
        </div>
        <Button className="mt-5 w-full" disabled={checkout.isPending} onClick={() => checkout.mutate()}>
          {checkout.isPending ? "Đang tạo thanh toán..." : "Tiếp tục thanh toán"}
        </Button>
        <p className="mt-3 text-xs text-slate-500">Giá cuối cùng và trạng thái sân được xác nhận lại bởi backend khi tạo thanh toán.</p>
      </aside>
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "border-t border-line pt-3 text-base font-semibold" : ""}`}>
      <span className="text-slate-600">{label}</span>
      <span>{value}</span>
    </div>
  );
}

