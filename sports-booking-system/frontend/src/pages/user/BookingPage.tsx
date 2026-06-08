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

type FormValues = z.infer<typeof bookingSchema>;

export function BookingPage() {
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
      toast.success("Dat san thanh cong");
      navigate(`/payment/${booking.id}`);
    },
    onError: (error) => toast.error(error.message)
  });

  if (court.isLoading) return <LoadingState />;
  if (court.isError) return <ErrorState message={court.error.message} />;

  return (
    <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-[1fr_320px]">
      <form className="rounded-md border border-line bg-white p-5 shadow-sm" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <h1 className="text-2xl font-semibold">Dat san</h1>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Input label="Ngay dat" type="date" {...form.register("bookingDate")} error={form.formState.errors.bookingDate?.message} />
          <Input label="Gio bat dau" type="time" {...form.register("startTime")} error={form.formState.errors.startTime?.message} />
          <Input label="Gio ket thuc" type="time" {...form.register("endTime")} error={form.formState.errors.endTime?.message} />
          <Select
            label="Thanh toan"
            {...form.register("paymentMethod")}
            options={[
              { value: "CASH", label: "Tien mat" },
              { value: "BANK_TRANSFER", label: "Chuyen khoan" },
              { value: "E_WALLET", label: "Vi dien tu" },
              { value: "MOCK_PAYMENT", label: "Thanh toan demo" }
            ]}
          />
        </div>
        <Button className="mt-5" disabled={mutation.isPending}>{mutation.isPending ? "Dang dat" : "Xac nhan dat san"}</Button>
      </form>
      <aside className="h-max rounded-md border border-line bg-white p-5">
        <h2 className="font-semibold">{court.data?.name}</h2>
        <p className="mt-2 text-sm text-slate-600">{court.data?.address}</p>
        <p className="mt-4 text-sm text-slate-500">Tong tien cuoi cung duoc tinh va tra ve tu backend.</p>
      </aside>
    </div>
  );
}
