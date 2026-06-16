import { useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
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

export function TeammateCreatePage() {
  const [form, setForm] = useState<TeamRecruitmentInput>(initialForm);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const created = await contentApi.createTeamPost({
        ...form,
        playingDate: form.playingDate || null,
        extraServices: form.extraServices || null,
        note: form.note || null,
        zaloGroupLink: form.zaloGroupLink || null,
        zaloQrImage: form.zaloQrImage || null
      });
      navigate(`/teammates/${created.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="bg-[#f5f7fb] px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
          <h1 className="text-4xl font-black">Đăng bài tìm đồng đội</h1>
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
              <input type="time" value={form.startTime} onChange={(event) => update("startTime", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Giờ kết thúc" error={errors.endTime}>
              <input type="time" value={form.endTime} onChange={(event) => update("endTime", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Dịch vụ thêm" className="md:col-span-2">
              <input value={form.extraServices ?? ""} onChange={(event) => update("extraServices", event.target.value)} className={inputClass} placeholder="Áo bib, nước uống, gửi xe..." />
            </Field>
            <Field label="Ghi chú" className="md:col-span-2">
              <textarea value={form.note ?? ""} onChange={(event) => update("note", event.target.value)} className={`${inputClass} min-h-28 py-3`} />
            </Field>
            <Field label="Link nhóm Zalo">
              <input value={form.zaloGroupLink ?? ""} onChange={(event) => update("zaloGroupLink", event.target.value)} className={inputClass} placeholder="https://zalo.me/g/..." />
            </Field>
            <Field label="Ảnh QR nhóm Zalo">
              <input value={form.zaloQrImage ?? ""} onChange={(event) => update("zaloQrImage", event.target.value)} className={inputClass} placeholder="URL ảnh QR" />
            </Field>
            <div className="md:col-span-2">
              <button disabled={submitting} className="rounded-xl bg-emerald-700 px-6 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:opacity-60">
                {submitting ? "Đang đăng..." : "Đăng bài tìm đồng đội"}
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
