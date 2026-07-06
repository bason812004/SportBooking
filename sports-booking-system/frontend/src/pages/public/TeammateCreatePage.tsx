import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, LoadingState } from "../../components/common/States";
import { contentApi } from "../../features/content/api/contentApi";
import type { TeamRecruitmentInput } from "../../types/api";

const sportOptions = ["Bóng đá", "Tennis", "Bóng chuyền", "Cầu lông", "Bóng rổ", "Pickleball"];

type Errors = Partial<Record<keyof TeamRecruitmentInput, string>>;

const initialForm: TeamRecruitmentInput = {
  title: "",
  sportType: "Bóng đá",
  courtName: "",
  address: "",
  currentPlayers: 0,
  maxPlayers: 10,
  playingDate: "",
  startTime: "19:00",
  endTime: "21:00",
  pricePerPerson: 0,
  extraServices: "",
  note: "",
  zaloGroupLink: "",
  zaloQrImage: ""
};

function normalizeTime(value?: string | null) {
  return value?.slice(0, 5) || "";
}

function normalizeDate(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function TeammateCreatePage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const [form, setForm] = useState<TeamRecruitmentInput>(initialForm);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const detail = useQuery({
    queryKey: ["team-post-edit", id],
    queryFn: () => contentApi.teamPost(id!),
    enabled: editing
  });

  useEffect(() => {
    if (!detail.data) return;
    setForm({
      courtId: null,
      title: detail.data.title,
      sportType: detail.data.sportType,
      courtName: detail.data.courtName,
      address: detail.data.address,
      currentPlayers: detail.data.currentPlayers,
      maxPlayers: detail.data.maxPlayers,
      playingDate: normalizeDate(detail.data.playingDate),
      startTime: normalizeTime(detail.data.startTime),
      endTime: normalizeTime(detail.data.endTime),
      pricePerPerson: detail.data.pricePerPerson,
      extraServices: detail.data.extraServices ?? "",
      note: detail.data.note ?? "",
      zaloGroupLink: detail.data.zaloGroupLink ?? "",
      zaloQrImage: detail.data.zaloQrImage ?? ""
    });
  }, [detail.data]);

  function update<K extends keyof TeamRecruitmentInput>(key: K, value: TeamRecruitmentInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate() {
    const next: Errors = {};
    if (!form.title.trim()) next.title = "Tiêu đề không được rỗng";
    if (!form.courtName.trim()) next.courtName = "Tên sân không được rỗng";
    if (!form.address.trim()) next.address = "Địa chỉ không được rỗng";
    if (form.maxPlayers <= form.currentPlayers) next.maxPlayers = "Số người tối đa phải lớn hơn số người hiện có";
    if (form.pricePerPerson < 0) next.pricePerPerson = "Giá mỗi người không được âm";
    if (form.endTime <= form.startTime) next.endTime = "Giờ kết thúc phải sau giờ bắt đầu";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleQrFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn file ảnh QR.");
      return;
    }
    if (file.size > 700 * 1024) {
      toast.error("Ảnh QR nên nhỏ hơn 700KB.");
      return;
    }
    update("zaloQrImage", await fileToDataUrl(file));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload: TeamRecruitmentInput = {
        ...form,
        playingDate: form.playingDate || null,
        extraServices: form.extraServices || null,
        note: form.note || null,
        zaloGroupLink: form.zaloGroupLink || null,
        zaloQrImage: form.zaloQrImage || null
      };
      if (editing && id) {
        await contentApi.updateTeamPost(id, payload);
        toast.success("Đã cập nhật bài tìm đồng đội.");
      } else {
        await contentApi.createTeamPost(payload);
        toast.success("Đã đăng bài tìm đồng đội.");
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["team-posts"] }),
        queryClient.invalidateQueries({ queryKey: ["my-team-posts"] })
      ]);
      navigate("/user/teammates", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể lưu bài tìm đồng đội.");
    } finally {
      setSubmitting(false);
    }
  }

  if (editing && detail.isLoading) return <div className="px-4 py-16"><LoadingState /></div>;
  if (editing && detail.isError) return <div className="px-4 py-16"><ErrorState message={detail.error.message} /></div>;

  return (
    <section className="bg-[#f5f7fb] px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
          <h1 className="text-4xl font-black">{editing ? "Chỉnh sửa bài tìm đồng đội" : "Đăng bài tìm đồng đội"}</h1>
          <form onSubmit={handleSubmit} className="mt-8 grid gap-5 md:grid-cols-2">
            <Field label="Tiêu đề bài đăng" error={errors.title} className="md:col-span-2">
              <input value={form.title} onChange={(event) => update("title", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Loại thể thao">
              <select value={form.sportType} onChange={(event) => update("sportType", event.target.value)} className={inputClass}>
                {sportOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="Tên sân" error={errors.courtName}>
              <input value={form.courtName} onChange={(event) => update("courtName", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Địa chỉ" error={errors.address} className="md:col-span-2">
              <input value={form.address} onChange={(event) => update("address", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Số người hiện có">
              <input type="number" min="0" value={form.currentPlayers} onChange={(event) => update("currentPlayers", Number(event.target.value))} className={inputClass} />
            </Field>
            <Field label="Số người tối đa" error={errors.maxPlayers}>
              <input type="number" min="1" value={form.maxPlayers} onChange={(event) => update("maxPlayers", Number(event.target.value))} className={inputClass} />
            </Field>
            <Field label="Ngày chơi">
              <input type="date" value={form.playingDate ?? ""} onChange={(event) => update("playingDate", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Giá mỗi người" error={errors.pricePerPerson}>
              <input type="number" min="0" value={form.pricePerPerson} onChange={(event) => update("pricePerPerson", Number(event.target.value))} className={inputClass} />
            </Field>
            <Field label="Giờ bắt đầu">
              <input type="time" step={3600} value={form.startTime} onChange={(event) => update("startTime", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Giờ kết thúc" error={errors.endTime}>
              <input type="time" step={3600} value={form.endTime} onChange={(event) => update("endTime", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Dịch vụ thêm" className="md:col-span-2">
              <input value={form.extraServices ?? ""} onChange={(event) => update("extraServices", event.target.value)} className={inputClass} placeholder="Áo đấu, nước uống, gửi xe..." />
            </Field>
            <Field label="Ghi chú" className="md:col-span-2">
              <textarea value={form.note ?? ""} onChange={(event) => update("note", event.target.value)} className={`${inputClass} min-h-28 py-3`} />
            </Field>
            <Field label="Link nhóm Zalo">
              <input value={form.zaloGroupLink ?? ""} onChange={(event) => update("zaloGroupLink", event.target.value)} className={inputClass} placeholder="https://zalo.me/g/..." />
            </Field>
            <Field label="Ảnh QR nhóm Zalo">
              <div className="space-y-3">
                <input value={form.zaloQrImage?.startsWith("data:") ? "" : form.zaloQrImage ?? ""} onChange={(event) => update("zaloQrImage", event.target.value)} className={inputClass} placeholder="URL ảnh QR hoặc tải ảnh bên dưới" />
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-emerald-800 hover:bg-emerald-50">
                  <ImagePlus className="h-4 w-4" />
                  Tải ảnh QR
                  <input type="file" accept="image/*" className="sr-only" onChange={handleQrFile} />
                </label>
                {form.zaloQrImage && (
                  <div className="relative w-fit">
                    <img src={form.zaloQrImage} alt="QR nhóm Zalo" className="h-28 w-28 rounded-xl border border-slate-200 object-cover" />
                    <button type="button" onClick={() => update("zaloQrImage", "")} className="absolute -right-2 -top-2 rounded-full bg-slate-950 p-1 text-white" aria-label="Xóa ảnh QR">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </Field>
            <div className="md:col-span-2">
              <button disabled={submitting} className="rounded-xl bg-emerald-700 px-6 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? "Đang lưu..." : editing ? "Cập nhật bài" : "Đăng bài tìm đồng đội"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

function Field({ label, error, children, className = "" }: { label: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`grid gap-2 text-sm font-bold text-slate-700 ${className}`}>
      <span>{label}</span>
      {children}
      {error && <span className="text-xs font-bold text-rose-600">{error}</span>}
    </label>
  );
}

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
