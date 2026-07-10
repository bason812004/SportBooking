import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { ErrorState, LoadingState } from "../../components/common/States";
import { partnerApi } from "../../features/partner/api/partnerApi";

type Values = {
  courtId: string;
  title: string;
  description?: string;
  sportType: string;
  coverImageUrl?: string;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  maxParticipants: number;
  entryFee: number;
  prizeDescription?: string;
};

const local = (value: string) => value?.slice(0, 16);

export function PartnerTournamentFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useForm<Values>({ defaultValues: { maxParticipants: 16, entryFee: 0 } });
  const courts = useQuery({ queryKey: ["partner-courts"], queryFn: partnerApi.courts });
  const detail = useQuery({ queryKey: ["partner-tournament", id], queryFn: () => partnerApi.tournamentDetail(id!), enabled: Boolean(id) });

  useEffect(() => {
    if (!detail.data) return;
    form.reset({
      ...detail.data,
      startDate: local(detail.data.startDate),
      endDate: local(detail.data.endDate),
      registrationDeadline: local(detail.data.registrationDeadline),
      description: detail.data.description ?? "",
      coverImageUrl: detail.data.coverImageUrl ?? "",
      prizeDescription: detail.data.prizeDescription ?? ""
    });
  }, [detail.data, form]);

  const save = useMutation({
    mutationFn: (values: Values) => {
      const payload = {
        ...values,
        startDate: new Date(values.startDate).toISOString(),
        endDate: new Date(values.endDate).toISOString(),
        registrationDeadline: new Date(values.registrationDeadline).toISOString()
      };
      return id ? partnerApi.updateTournament(id, payload) : partnerApi.createTournament(payload);
    },
    onSuccess: async () => {
      toast.success("Đã lưu giải đấu");
      await queryClient.invalidateQueries({ queryKey: ["partner-tournaments"] });
      navigate("/partner/tournaments");
    },
    onError: (error) => toast.error(error.message)
  });

  if (courts.isLoading || (id && detail.isLoading)) return <LoadingState />;
  if (courts.isError) return <ErrorState message={courts.error.message} />;
  if (id && detail.isError) return <ErrorState message={detail.error.message} />;

  return (
    <form className="space-y-5 rounded-2xl border bg-white p-6" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
      <h1 className="text-3xl font-bold">{id ? "Sửa giải đấu" : "Tạo giải đấu"}</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Tên giải" {...form.register("title", { required: true })} />
        <Select label="Sân tổ chức" options={courts.data?.map((c) => ({ value: c.id, label: c.name })) ?? []} {...form.register("courtId", { required: true })} />
        <Input label="Môn thể thao" {...form.register("sportType", { required: true })} />
        <Input label="Ảnh bìa (URL)" type="url" {...form.register("coverImageUrl")} />
        <Input label="Hạn đăng ký" type="datetime-local" {...form.register("registrationDeadline", { required: true })} />
        <Input label="Bắt đầu" type="datetime-local" {...form.register("startDate", { required: true })} />
        <Input label="Kết thúc" type="datetime-local" {...form.register("endDate", { required: true })} />
        <Input label="Số người tối đa" type="number" {...form.register("maxParticipants", { valueAsNumber: true, min: 1 })} />
        <Input label="Phí tham gia" type="number" {...form.register("entryFee", { valueAsNumber: true, min: 0 })} />
        <Input label="Giải thưởng" {...form.register("prizeDescription")} />
        <label className="grid gap-1 md:col-span-2">
          Mô tả
          <textarea className="min-h-32 rounded-md border p-3" {...form.register("description")} />
        </label>
      </div>
      <div className="flex gap-2">
        <Button disabled={save.isPending}>Lưu bản nháp</Button>
        <Button type="button" variant="secondary" onClick={() => navigate("/partner/tournaments")}>Hủy</Button>
      </div>
    </form>
  );
}
