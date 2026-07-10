import { useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Eye, Lock, Megaphone, Star, Unlock } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "../../features/admin/api/adminApi";
import type { AdminCourt } from "../../types/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { ErrorState, LoadingState } from "../../components/common/States";
import { SortableTh } from "../../components/common/SortableTh";
import { StatusBadge } from "../../components/common/StatusBadge";
import { Table as SharedTable, THead, TBody, Tr, Th, Td } from "../../components/common/Table";
import { useUrlSort } from "../../hooks/useUrlSort";

const approvalLabels: Record<string, string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối"
};
const activeLabels: Record<string, string> = {
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Đã khóa"
};
const approvalToneClasses: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800"
};
const activeToneClasses: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  INACTIVE: "bg-slate-200 text-slate-700"
};

const emptyFilters = {
  search: "",
  city: "",
  district: "",
  partnerId: "",
  approvalStatus: "",
  activeStatus: "",
  verified: "",
  featured: ""
};
const fallbackCourtImage = "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=640&q=80";

type Filters = typeof emptyFilters;

type SortField = "name" | "businessName" | "city" | "minPrice" | "approvalStatus" | "activeStatus" | "updateRequestedAt";
const SORT_FIELDS: SortField[] = ["name", "businessName", "city", "minPrice", "approvalStatus", "activeStatus", "updateRequestedAt"];

export function AdminCourtsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [selected, setSelected] = useState<string | null>(null);

  const { sortField, sortOrder, handleSort: sortBy } = useUrlSort<SortField>({ fields: SORT_FIELDS, default: null });
  const handleSort = (field: SortField) => {
    setPage(1);
    sortBy(field);
  };

  const courts = useQuery({
    queryKey: ["admin-courts", page, filters, sortField, sortOrder],
    queryFn: () => adminApi.courts({ page, limit: 10, ...filters, sortBy: sortField ?? undefined, sortOrder }),
    placeholderData: keepPreviousData
  });
  const detail = useQuery({
    queryKey: ["admin-court", selected],
    queryFn: () => adminApi.courtDetail(selected!),
    enabled: Boolean(selected)
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-courts"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-court", selected] });
  };

  if (courts.isLoading) return <LoadingState />;
  if (courts.isError) return <ErrorState message={courts.error.message} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Tất cả sân</h1>
          <p className="text-sm text-slate-600">Quản lý sân đã duyệt, khóa/mở hoạt động, verified, featured và yêu cầu đối tác cập nhật.</p>
        </div>
        <Button variant="secondary" onClick={() => { setPage(1); setFilters(emptyFilters); }}>
          Xóa lọc
        </Button>
      </div>

      <div className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-2 xl:grid-cols-4">
        <Input label="Tìm kiếm" value={filters.search} onChange={(event) => updateFilter(setPage, setFilters, "search", event.target.value)} placeholder="Tên sân, địa chỉ, đối tác" />
        <Input label="Thành phố" value={filters.city} onChange={(event) => updateFilter(setPage, setFilters, "city", event.target.value)} />
        <Input label="Quận/Huyện" value={filters.district} onChange={(event) => updateFilter(setPage, setFilters, "district", event.target.value)} />
        <Input label="ID đối tác" value={filters.partnerId} onChange={(event) => updateFilter(setPage, setFilters, "partnerId", event.target.value)} placeholder="pp0001" />
        <Select label="Duyệt sân" value={filters.approvalStatus} onChange={(event) => updateFilter(setPage, setFilters, "approvalStatus", event.target.value)} options={withAll(["PENDING", "APPROVED", "REJECTED"], approvalLabels)} />
        <Select label="Hoạt động" value={filters.activeStatus} onChange={(event) => updateFilter(setPage, setFilters, "activeStatus", event.target.value)} options={withAll(["ACTIVE", "INACTIVE"], activeLabels)} />
        <Select label="Verified" value={filters.verified} onChange={(event) => updateFilter(setPage, setFilters, "verified", event.target.value)} options={booleanOptions} />
        <Select label="Featured" value={filters.featured} onChange={(event) => updateFilter(setPage, setFilters, "featured", event.target.value)} options={booleanOptions} />
      </div>

      <SharedTable minWidth="1120px">
        <THead>
          <tr>
            <SortableTh label="Sân" field="name" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
            <SortableTh label="Đối tác" field="businessName" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
            <SortableTh label="Địa điểm" field="city" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
            <SortableTh label="Giá từ" field="minPrice" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
            <SortableTh label="Duyệt" field="approvalStatus" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
            <SortableTh label="Hoạt động" field="activeStatus" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
            <Th>Nhãn</Th>
            <SortableTh label="Yêu cầu cập nhật" field="updateRequestedAt" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
            <Th></Th>
          </tr>
        </THead>
        <TBody>
          {courts.data?.items.map((court) => (
            <Tr key={court.id} className="align-top">
              <Td>
                <div className="flex items-center gap-3">
                  <img className="h-14 w-20 rounded-md object-cover" src={court.imageUrl || fallbackCourtImage} alt={court.name} />
                  <div>
                    <p className="font-bold">{court.name}</p>
                    <p className="text-xs text-slate-500">{court.id}</p>
                  </div>
                </div>
              </Td>
              <Td>{court.partner.businessName}<br /><span className="text-xs text-slate-500">{court.partner.user.email}</span></Td>
              <Td>{court.district}, {court.city}<br /><span className="text-xs text-slate-500">{court.address}</span></Td>
              <Td>{formatMoney(court.minPrice ?? 0)}</Td>
              <Td><StatusBadge value={court.approvalStatus} tones={approvalToneClasses} labels={approvalLabels} /></Td>
              <Td><StatusBadge value={court.activeStatus} tones={activeToneClasses} labels={activeLabels} /></Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {court.verified && <SmallBadge>Verified</SmallBadge>}
                  {court.featured && <SmallBadge>Featured</SmallBadge>}
                  {!court.verified && !court.featured && <span className="text-xs text-slate-500">Chưa gắn</span>}
                </div>
              </Td>
              <Td>{court.updateRequestedAt ? new Date(court.updateRequestedAt).toLocaleString("vi-VN") : "-"}</Td>
              <Td className="text-right">
                <Button variant="secondary" onClick={() => setSelected(court.id)}>
                  <Eye className="h-4 w-4" />
                  Chi tiết
                </Button>
              </Td>
            </Tr>
          ))}
        </TBody>
      </SharedTable>
      {!courts.data?.items.length && <p className="p-6 text-center text-slate-500">Không có sân phù hợp</p>}

      <Pager page={page} total={courts.data?.meta.totalPages ?? 1} setPage={setPage} />

      <CourtDetailModal open={Boolean(selected)} onClose={() => setSelected(null)}>
        {detail.isLoading && <LoadingState />}
        {detail.isError && <ErrorState message={detail.error.message} />}
        {detail.data && <CourtDetail court={detail.data} onUpdated={refresh} />}
      </CourtDetailModal>
    </div>
  );
}

function CourtDetailModal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6" onMouseDown={onClose}>
      <div className="flex max-h-[calc(100vh-48px)] w-full max-w-6xl flex-col rounded-lg bg-white shadow-xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
          <h2 className="text-xl font-bold">Chi tiết sân</h2>
          <Button variant="secondary" onClick={onClose}>Đóng</Button>
        </div>
        <div className="min-h-0 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function CourtDetail({ court, onUpdated }: { court: AdminCourt; onUpdated: () => Promise<void> }) {
  const [adminNote, setAdminNote] = useState(court.adminNote ?? "");
  const [requestNote, setRequestNote] = useState("");

  useEffect(() => {
    setAdminNote(court.adminNote ?? "");
    setRequestNote("");
  }, [court]);

  const update = useMutation({
    mutationFn: (payload: { activeStatus?: string; verified?: boolean; featured?: boolean; adminNote?: string }) =>
      adminApi.updateCourtAdmin(court.id, payload),
    onSuccess: async () => {
      toast.success("Đã cập nhật sân");
      await onUpdated();
    },
    onError: (error) => toast.error(error.message)
  });

  const requestUpdate = useMutation({
    mutationFn: () => adminApi.requestCourtUpdate(court.id, requestNote),
    onSuccess: async () => {
      toast.success("Đã gửi yêu cầu cập nhật");
      setRequestNote("");
      await onUpdated();
    },
    onError: (error) => toast.error(error.message)
  });

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold">{court.name}</h2>
          <p className="text-sm text-slate-600">{court.address}, {court.district}, {court.city}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Info title="Đối tác" lines={[court.partner.businessName, court.partner.user.fullName, court.partner.user.email, court.partner.user.phone]} />
          <Info title="Thông tin sân" lines={[court.category?.name, court.contactPhone, court.contactEmail, court.mapUrl]} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(court.images?.length ? court.images : [{ id: "placeholder", imageUrl: court.imageUrl || fallbackCourtImage, sortOrder: 0 }]).map((image) => (
            <img key={image.id} className="aspect-[4/3] w-full rounded-lg object-cover" src={image.imageUrl} alt={court.name} />
          ))}
        </div>

        <SimpleTable title="Bảng giá" empty="Chưa có bảng giá">
          <THead>
            <tr>
              <Th>Loại ngày</Th>
              <Th>Khung giờ</Th>
              <Th>Giá</Th>
              <Th>Ghi chú</Th>
            </tr>
          </THead>
          <TBody>
            {court.prices?.map((price) => (
              <Tr key={price.id}>
                <Td>{price.dayType}</Td>
                <Td>{formatTime(price.startTime)} - {formatTime(price.endTime)}</Td>
                <Td>{formatMoney(price.price)}</Td>
                <Td>{price.note || "-"}</Td>
              </Tr>
            ))}
          </TBody>
        </SimpleTable>

        <SimpleTable title="Dịch vụ" empty="Chưa có dịch vụ">
          <THead>
            <tr>
              <Th>Dịch vụ</Th>
              <Th>Mô tả</Th>
              <Th>Giá</Th>
              <Th>Trạng thái</Th>
            </tr>
          </THead>
          <TBody>
            {court.services?.map((service) => (
              <Tr key={service.id}>
                <Td className="font-medium">{service.name}</Td>
                <Td>{service.description || "-"}</Td>
                <Td>{formatMoney(service.price)}</Td>
                <Td>{service.status}</Td>
              </Tr>
            ))}
          </TBody>
        </SimpleTable>
      </section>

      <aside className="space-y-4">
        <div className="rounded-lg border bg-slate-50 p-4">
          <h3 className="font-bold">Trạng thái</h3>
          <div className="mt-3 grid gap-2">
            <StatusBadge value={court.approvalStatus} tones={approvalToneClasses} labels={approvalLabels} />
            <StatusBadge value={court.activeStatus} tones={activeToneClasses} labels={activeLabels} />
            {court.verified && <SmallBadge>Verified</SmallBadge>}
            {court.featured && <SmallBadge>Featured</SmallBadge>}
          </div>
        </div>

        <div className="grid gap-2">
          <Button variant={court.activeStatus === "ACTIVE" ? "danger" : "secondary"} disabled={update.isPending} onClick={() => update.mutate({ activeStatus: court.activeStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE" })}>
            {court.activeStatus === "ACTIVE" ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            {court.activeStatus === "ACTIVE" ? "Khóa hoạt động" : "Mở hoạt động"}
          </Button>
          <Button variant="secondary" disabled={update.isPending} onClick={() => update.mutate({ verified: !court.verified })}>
            <BadgeCheck className="h-4 w-4" />
            {court.verified ? "Gỡ verified" : "Gắn verified"}
          </Button>
          <Button variant="secondary" disabled={update.isPending} onClick={() => update.mutate({ featured: !court.featured })}>
            <Star className="h-4 w-4" />
            {court.featured ? "Gỡ featured" : "Gắn featured"}
          </Button>
        </div>

        <div className="rounded-lg border p-4">
          <h3 className="font-bold">Ghi chú admin</h3>
          <textarea className="mt-3 min-h-28 w-full rounded-md border border-line p-3 text-sm outline-none focus:border-action" value={adminNote} onChange={(event) => setAdminNote(event.target.value)} />
          <Button className="mt-3 w-full" disabled={update.isPending} onClick={() => update.mutate({ adminNote })}>
            Lưu ghi chú
          </Button>
        </div>

        <div className="rounded-lg border p-4">
          <h3 className="font-bold">Yêu cầu cập nhật</h3>
          {court.updateRequestNote && <p className="mt-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900">{court.updateRequestNote}</p>}
          <textarea className="mt-3 min-h-28 w-full rounded-md border border-line p-3 text-sm outline-none focus:border-action" value={requestNote} onChange={(event) => setRequestNote(event.target.value)} placeholder="Nội dung cần partner cập nhật" />
          <Button className="mt-3 w-full" disabled={requestUpdate.isPending || requestNote.trim().length < 3} onClick={() => requestUpdate.mutate()}>
            <Megaphone className="h-4 w-4" />
            Gửi yêu cầu
          </Button>
        </div>
      </aside>
    </div>
  );
}

function Info({ title, lines }: { title: string; lines: Array<string | number | null | undefined> }) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="font-bold">{title}</h3>
      <div className="mt-2 space-y-1 text-sm text-slate-600">
        {lines.filter(Boolean).map((line, index) => <p key={index}>{line}</p>)}
      </div>
    </div>
  );
}

function SimpleTable({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 font-bold">{title}</h3>
      <SharedTable minWidth="720px">{children}</SharedTable>
      <p className="sr-only">{empty}</p>
    </div>
  );
}

function SmallBadge({ children }: { children: ReactNode }) {
  return <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{children}</span>;
}

function Pager({ page, total, setPage }: { page: number; total: number; setPage: (page: number) => void }) {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</Button>
      <Button variant="secondary" disabled={page >= total} onClick={() => setPage(page + 1)}>Sau</Button>
    </div>
  );
}

function updateFilter(setPage: (page: number) => void, setFilters: Dispatch<SetStateAction<Filters>>, key: keyof Filters, value: string) {
  setPage(1);
  setFilters((current) => ({ ...current, [key]: value }));
}

function withAll(values: string[], labels: Record<string, string>) {
  return [{ value: "", label: "Tất cả" }, ...values.map((value) => ({ value, label: labels[value] ?? value }))];
}

const booleanOptions = [
  { value: "", label: "Tất cả" },
  { value: "true", label: "Có" },
  { value: "false", label: "Không" }
];

function formatMoney(value?: number | string | null) {
  return `${Number(value ?? 0).toLocaleString("vi-VN")} đ`;
}

function formatTime(value?: string | null) {
  return value ? value.slice(0, 5) : "-";
}
