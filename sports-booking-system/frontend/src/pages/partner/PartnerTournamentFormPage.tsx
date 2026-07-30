import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Trophy } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { ErrorState, LoadingState } from "../../components/common/States";
import { PageHero } from "../../components/common/PageHero";
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
      toast.success(id ? "Đã cập nhật giải đấu" : "Đã tạo giải đấu, đang chờ Admin duyệt");
      await queryClient.invalidateQueries({ queryKey: ["partner-tournaments"] });
      navigate("/partner/tournaments");
    },
    onError: (error) => toast.error(error.message)
  });

  if (courts.isLoading || (id && detail.isLoading)) return <LoadingState />;
  if (courts.isError) return <ErrorState message={courts.error.message} />;
  if (id && detail.isError) return <ErrorState message={detail.error.message} />;

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Nội dung"
        title={id ? "Sửa giải đấu" : "Tạo giải đấu"}
        subtitle={id ? "Cập nhật thông tin giải đấu của bạn." : "Giải đấu sẽ được gửi cho Admin duyệt ngay sau khi tạo."}
      />

      <form className="space-y-6 rounded-2xl border border-line bg-white p-6" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
        <div>
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            <Trophy className="h-4 w-4" /> Thông tin giải đấu
          </div>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <Input label="Tên giải" {...form.register("title", { required: true })} />
            <Select label="Sân tổ chức" options={courts.data?.map((c) => ({ value: c.id, label: c.name })) ?? []} {...form.register("courtId", { required: true })} />
            <Input label="Môn thể thao" {...form.register("sportType", { required: true })} />
            <Input label="Ảnh bìa (URL)" type="url" {...form.register("coverImageUrl")} />
          </div>
        </div>

        <div className="border-t border-line pt-5">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Thời gian</p>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <Input label="Hạn đăng ký" type="datetime-local" {...form.register("registrationDeadline", { required: true })} />
            <Input label="Bắt đầu" type="datetime-local" {...form.register("startDate", { required: true })} />
            <Input label="Kết thúc" type="datetime-local" {...form.register("endDate", { required: true })} />
          </div>
        </div>

        <div className="border-t border-line pt-5">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Quy mô &amp; giải thưởng</p>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <Input label="Số người tối đa" type="number" {...form.register("maxParticipants", { valueAsNumber: true, min: 1 })} />
            <Input label="Phí tham gia (đ)" type="number" {...form.register("entryFee", { valueAsNumber: true, min: 0 })} />
            <Input label="Giải thưởng" {...form.register("prizeDescription")} />
          </div>
        </div>

        <div className="border-t border-line pt-5">
          <label className="grid gap-1.5">
            <span className="text-sm font-bold uppercase tracking-wide text-slate-500">Mô tả</span>
            <textarea className="min-h-32 rounded-md border border-line p-3 text-sm" {...form.register("description")} />
          </label>
        </div>

        <div className="flex gap-2 border-t border-line pt-5">
          <Button disabled={save.isPending}>{id ? "Lưu thay đổi" : "Tạo giải đấu"}</Button>
          <Button type="button" variant="secondary" onClick={() => navigate("/partner/tournaments")}>Hủy</Button>
        </div>
      </form>
    </div>
  );
}
