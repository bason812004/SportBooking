import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { LoadingState, ErrorState } from "../../components/common/States";
import { bookingApi } from "../../features/bookings/api/bookingApi";
import { bookingSchema } from "../../features/bookings/schemas/bookingSchema";
import { useCourt } from "../../features/courts/hooks/useCourts";
import { useLanguage } from "../../lib/i18n";

type FormValues = z.infer<typeof bookingSchema>;

export function BookingPage() {
  const { t } = useLanguage();
  const { courtId } = useParams();
  const navigate = useNavigate();
  const court = useCourt(courtId);
  const form = useForm<FormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: { paymentMethod: "CASH", bookingDate: "", startTime: "18:00", endTime: "19:00" }
  });
  const mutation = useMutation({
    mutationFn: (values: FormValues) => bookingApi.create({ ...values, courtId: courtId!, services: [] }),
    onSuccess: (booking) => {
      toast.success(t("Đặt sân thành công"));
      navigate(`/payment/${booking.id}`);
    },
    onError: (error) => toast.error(error.message)
  });

  if (court.isLoading) return <LoadingState />;
  if (court.isError) return <ErrorState message={court.error.message} />;

  return (
    <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-[1fr_320px]">
      <form className="rounded-md border border-line bg-white p-5 shadow-sm" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <h1 className="text-2xl font-semibold">{t("Đặt sân")}</h1>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Input label={t("Ngày đặt")} type="date" {...form.register("bookingDate")} error={form.formState.errors.bookingDate?.message} />
          <Input label={t("Giờ bắt đầu")} type="time" {...form.register("startTime")} error={form.formState.errors.startTime?.message} />
          <Input label={t("Giờ kết thúc")} type="time" {...form.register("endTime")} error={form.formState.errors.endTime?.message} />
          <Select
            label={t("Thanh toán")}
            {...form.register("paymentMethod")}
            options={[
              { value: "CASH", label: t("Tiền mặt") },
              { value: "BANK_TRANSFER", label: t("Chuyển khoản") },
              { value: "E_WALLET", label: t("Ví điện tử") },
              { value: "MOCK_PAYMENT", label: t("Thanh toán demo") }
            ]}
          />
        </div>
        <Button className="mt-5" disabled={mutation.isPending}>{mutation.isPending ? t("Đang đặt") : t("Xác nhận đặt sân")}</Button>
      </form>
      <aside className="h-max rounded-md border border-line bg-white p-5">
        <h2 className="font-semibold">{court.data?.name}</h2>
        <p className="mt-2 text-sm text-slate-600">{court.data?.address}</p>
        <p className="mt-4 text-sm text-slate-500">{t("Tổng tiền cuối cùng được tính và trả về từ backend.")}</p>
      </aside>
    </div>
  );
}
