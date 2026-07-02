import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Image,
  MapPin,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Wrench
} from "lucide-react";
import { partnerApi } from "../../features/partner/api/partnerApi";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import type { Court } from "../../types/api";

const approvalLabels: Record<Court["approvalStatus"], string> = {
  APPROVED: "Đã duyệt",
  PENDING: "Chờ duyệt",
  REJECTED: "Bị từ chối"
};

const activeLabels: Record<Court["activeStatus"], string> = {
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Tạm ngưng"
};

const approvalClass: Record<Court["approvalStatus"], string> = {
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-700"
};

function formatTime(value?: string) {
  if (!value) return "--:--";
  if (/^\d{2}:\d{2}/.test(value)) return value.slice(0, 5);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 5);
  return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function profileScore(court: Court) {
  const checks = [
    Boolean(court.images?.length),
    Boolean(court.prices?.length),
    Boolean(court.services?.length),
    Boolean(court.description),
    Boolean(court.latitude && court.longitude)
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

function CourtCard({ court }: { court: Court }) {
  const imageUrl = court.images?.[0]?.imageUrl;
  const score = profileScore(court);
  const needsPrice = !court.prices?.length;
  const needsImage = !court.images?.length;

  return (
    <article className="overflow-hidden rounded-lg border border-line bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-[4/3] bg-slate-100">
        {imageUrl ? (
          <img src={imageUrl} alt={court.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
            <Image className="h-10 w-10" />
            <p className="text-sm font-bold">Chưa có ảnh sân</p>
            <Link to={`/partner/courts/${court.id}/images`}>
              <Button variant="secondary">Thêm ảnh</Button>
            </Link>
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-black ${approvalClass[court.approvalStatus]}`}>
            {approvalLabels[court.approvalStatus]}
          </span>
          <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-black text-slate-700">
            {activeLabels[court.activeStatus]}
          </span>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <h2 className="line-clamp-1 text-lg font-black text-slate-950">{court.name}</h2>
          <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-slate-500">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">{court.category.name} · {court.district}, {court.city}</span>
          </p>
          <p className="mt-2 flex items-center gap-1 text-sm text-slate-600">
            <Clock3 className="h-4 w-4 shrink-0" />
            {formatTime(court.openingTime)} - {formatTime(court.closingTime)}
            {court.courtCount ? <span className="font-semibold">· {court.courtCount} sân con</span> : null}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Hồ sơ sân</span>
            <span>{score}%</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-rose-500"}`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{court.images?.length ?? 0} ảnh</span>
          <span className={`rounded-full px-3 py-1 ${needsPrice ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
            {needsPrice ? "Chưa có giá" : "Có bảng giá"}
          </span>
          {needsImage && <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">Thiếu ảnh</span>}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link to={`/partner/courts/${court.id}/edit`}>
            <Button className="w-full" variant="secondary"><Pencil className="h-4 w-4" />Sửa</Button>
          </Link>
          <Link to={`/partner/courts/${court.id}/images`}>
            <Button className="w-full" variant="secondary"><Image className="h-4 w-4" />Ảnh</Button>
          </Link>
          <Link to={`/partner/courts/${court.id}/prices`}>
            <Button className="w-full" variant="secondary"><Wrench className="h-4 w-4" />Giá</Button>
          </Link>
          <Link to={`/partner/calendar?courtId=${court.id}`}>
            <Button className="w-full" variant="secondary"><CalendarDays className="h-4 w-4" />Lịch</Button>
          </Link>
        </div>
      </div>
    </article>
  );
}

export function PartnerCourtsPage() {
  const [search, setSearch] = useState("");
  const [approvalStatus, setApprovalStatus] = useState("");
  const [activeStatus, setActiveStatus] = useState("");
  const courts = useQuery({ queryKey: ["partner-courts"], queryFn: partnerApi.courts });

  const categories = useMemo(() => {
    const names = new Set(courts.data?.map((court) => court.category.name) ?? []);
    return Array.from(names).sort();
  }, [courts.data]);
  const [category, setCategory] = useState("");

  const filteredCourts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return (courts.data ?? []).filter((court) => {
      const matchesKeyword = !keyword || [court.name, court.city, court.district, court.category.name].some((value) => value.toLowerCase().includes(keyword));
      const matchesApproval = !approvalStatus || court.approvalStatus === approvalStatus;
      const matchesActive = !activeStatus || court.activeStatus === activeStatus;
      const matchesCategory = !category || court.category.name === category;
      return matchesKeyword && matchesApproval && matchesActive && matchesCategory;
    });
  }, [activeStatus, approvalStatus, category, courts.data, search]);

  if (courts.isLoading) return <LoadingState />;
  if (courts.isError) return <ErrorState message={courts.error.message} />;

  const total = courts.data?.length ?? 0;
  const activeCount = courts.data?.filter((court) => court.activeStatus === "ACTIVE").length ?? 0;
  const pendingCount = courts.data?.filter((court) => court.approvalStatus === "PENDING").length ?? 0;
  const incompleteCount = courts.data?.filter((court) => !court.images?.length || !court.prices?.length).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-black uppercase text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Quản lý trực quan
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Sân của tôi</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Theo dõi hình ảnh, trạng thái duyệt và mức độ hoàn thiện hồ sơ của từng sân trong một màn hình.
          </p>
        </div>
        <Link to="/partner/courts/create">
          <Button><Plus className="h-4 w-4" />Thêm sân</Button>
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tổng số sân" value={total} tone="text-slate-950" />
        <StatCard label="Đang hoạt động" value={activeCount} tone="text-emerald-700" />
        <StatCard label="Chờ duyệt" value={pendingCount} tone="text-amber-700" />
        <StatCard label="Cần bổ sung" value={incompleteCount} tone="text-rose-700" />
      </div>

      <section className="rounded-lg border border-line bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_220px_190px_190px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              aria-label="Tìm kiếm sân"
              className="pl-9"
              placeholder="Tìm tên sân, loại sân, khu vực..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Select
            aria-label="Lọc loại sân"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            options={[{ value: "", label: "Tất cả loại sân" }, ...categories.map((name) => ({ value: name, label: name }))]}
          />
          <Select
            aria-label="Lọc trạng thái duyệt"
            value={approvalStatus}
            onChange={(event) => setApprovalStatus(event.target.value)}
            options={[
              { value: "", label: "Tất cả duyệt" },
              { value: "APPROVED", label: "Đã duyệt" },
              { value: "PENDING", label: "Chờ duyệt" },
              { value: "REJECTED", label: "Bị từ chối" }
            ]}
          />
          <Select
            aria-label="Lọc hoạt động"
            value={activeStatus}
            onChange={(event) => setActiveStatus(event.target.value)}
            options={[
              { value: "", label: "Tất cả hoạt động" },
              { value: "ACTIVE", label: "Đang hoạt động" },
              { value: "INACTIVE", label: "Tạm ngưng" }
            ]}
          />
        </div>
        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-500">
          <SlidersHorizontal className="h-4 w-4" />
          Đang hiển thị {filteredCourts.length}/{total} sân
        </p>
      </section>

      {total === 0 ? (
        <EmptyState title="Chưa có sân" />
      ) : filteredCourts.length === 0 ? (
        <EmptyState title="Không tìm thấy sân phù hợp" />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredCourts.map((court) => (
            <CourtCard key={court.id} court={court} />
          ))}
        </div>
      )}
    </div>
  );
}
