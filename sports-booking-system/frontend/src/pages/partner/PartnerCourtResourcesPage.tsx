import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link, useParams } from "react-router-dom";
import clsx from "clsx";
import { ArrowDown, ArrowLeft, ArrowUp, CalendarClock, ChevronDown, ChevronUp, Clock3, ImagePlus, Loader2, Pencil, Plus, Sparkles, Star, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { ConfirmModal } from "../../components/common/ConfirmModal";
import { ScheduleLegend } from "../../components/common/ScheduleLegend";
import { DateNavigator } from "../../components/common/DateNavigator";
import { CourtScheduleGrid, type PartnerBlockSelection, type ScheduleRow } from "../../components/booking/CourtScheduleGrid";
import { SlotActionPopover, type PopoverAnchor } from "../../components/booking/SlotActionPopover";
import { BlockTimeRangeModal, type BulkForm, type BulkMode } from "../../components/partner/BlockTimeRangeModal";
import { BlockHistoryList } from "../../components/partner/BlockHistoryList";
import { PriceScheduleGrid, type PriceRule, type PriceScheduleRow } from "../../components/partner/PriceScheduleGrid";
import { PricePopover } from "../../components/partner/PricePopover";
import { partnerApi, type PartnerSurfaceSlot } from "../../features/partner/api/partnerApi";
import { timeText } from "../../lib/format";

type PriceForm = { dayType: string; startTime: string; endTime: string; price: number; note?: string };
type ServiceForm = { name: string; description?: string; price: number; status: string };
type RemoveTarget = { type: "price" | "service" | "image"; resourceId: string };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function mondayOf(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}
function addDaysIso(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function monthRange(monthStr: string) {
  const [y, m] = monthStr.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${monthStr}-01`, end: `${monthStr}-${String(lastDay).padStart(2, "0")}` };
}
function mergeContiguousSlots(selection: PartnerBlockSelection[]) {
  const sorted = [...selection].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const groups: PartnerBlockSelection[] = [];
  for (const slot of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.endTime === slot.startTime) last.endTime = slot.endTime;
    else groups.push({ ...slot });
  }
  return groups;
}

const removeConfirmCopy: Record<RemoveTarget["type"], { title: string; message: string }> = {
  price: { title: "Xác nhận xoá bảng giá", message: "Mức giá này sẽ bị xoá vĩnh viễn và không thể hoàn tác." },
  service: { title: "Xác nhận ẩn dịch vụ", message: "Dịch vụ sẽ bị ẩn khỏi trang đặt sân, khách hàng sẽ không còn thấy dịch vụ này." },
  image: { title: "Xác nhận xoá ảnh", message: "Ảnh này sẽ bị xoá vĩnh viễn khỏi sân và không thể hoàn tác." }
};

const dayTypeLabel: Record<string, string> = { WEEKDAY: "Ngày thường", WEEKEND: "Cuối tuần", HOLIDAY: "Ngày lễ" };
const dayTypeTone: Record<string, string> = {
  WEEKDAY: "bg-slate-100 text-slate-600",
  WEEKEND: "bg-blue-100 text-blue-700",
  HOLIDAY: "bg-amber-100 text-amber-700"
};
const serviceStatusTone: Record<string, string> = { ACTIVE: "bg-emerald-100 text-emerald-700", INACTIVE: "bg-slate-100 text-slate-500" };
const serviceStatusLabel: Record<string, string> = { ACTIVE: "Hoạt động", INACTIVE: "Tạm ẩn" };

export function PartnerCourtResourcesPage({ mode }: { mode: "prices" | "services" | "images" | "blocks" }) {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const court = useQuery({ queryKey: ["partner-court", id], queryFn: () => partnerApi.courtDetail(id) });
  const [gridDate, setGridDate] = useState(todayIso());
  const grid = useQuery({
    queryKey: ["partner-court-grid", id, gridDate],
    queryFn: () => partnerApi.courtAvailabilityGrid(id, gridDate),
    enabled: mode === "blocks"
  });
  const blocks = useQuery({ queryKey: ["partner-court-blocks", id], queryFn: () => partnerApi.courtBlocks(id), enabled: mode === "blocks" });
  const priceForm = useForm<PriceForm>({ defaultValues: { dayType: "WEEKDAY", startTime: "06:00", endTime: "07:00", price: 0 } });
  const serviceForm = useForm<ServiceForm>({ defaultValues: { price: 0, status: "ACTIVE" } });
  const bulkForm = useForm<BulkForm>({ defaultValues: { courtSurfaceId: "", date: todayIso(), month: todayIso().slice(0, 7), startTime: "06:00", endTime: "23:00", reason: "" } });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null);
  const [selection, setSelection] = useState<{ surfaceId: string; slots: PartnerBlockSelection[] } | null>(null);
  const [selectReason, setSelectReason] = useState("");
  const [unblockTarget, setUnblockTarget] = useState<{ surfaceId: string; slot: PartnerSurfaceSlot; anchor: PopoverAnchor } | null>(null);
  const [bulkMode, setBulkMode] = useState<BulkMode>("day");
  const [bulkWeekdays, setBulkWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [priceSelection, setPriceSelection] = useState<{ dayType: string; slots: PartnerBlockSelection[] } | null>(null);
  const [priceQuickValue, setPriceQuickValue] = useState("");
  const [priceCellPopover, setPriceCellPopover] = useState<{ dayType: string; rule: PriceRule; anchor: PopoverAnchor } | null>(null);
  const [manualPriceOpen, setManualPriceOpen] = useState(false);
  const [priceListOpen, setPriceListOpen] = useState(false);
  const [serviceFormOpen, setServiceFormOpen] = useState(false);
  const [imageDragOver, setImageDragOver] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["partner-court", id] });
    await queryClient.invalidateQueries({ queryKey: ["partner-courts"] });
  };

  const refreshBlocks = async () => {
    setSelection(null);
    setUnblockTarget(null);
    await queryClient.invalidateQueries({ queryKey: ["partner-court-blocks", id] });
    await queryClient.invalidateQueries({ queryKey: ["partner-court-grid", id] });
  };

  const createBlock = useMutation({
    mutationFn: (values: { courtSurfaceId: string | null; blockDate: string; startTime: string; endTime: string; reason?: string }) =>
      partnerApi.createCourtBlock(id, values),
    onError: (error: any) => toast.error(error.message || "Không thể tạo lịch nghỉ")
  });
  const cancelBlock = useMutation({
    mutationFn: (blockId: string) => partnerApi.cancelCourtBlock(id, blockId),
    onSuccess: async () => {
      toast.success("Đã hủy lịch nghỉ");
      await refreshBlocks();
    },
    onError: (error: any) => toast.error(error.message || "Không thể hủy lịch nghỉ")
  });
  const bulkBlock = useMutation({
    mutationFn: (values: BulkForm & { startDate: string; endDate: string; weekdays: number[] }) =>
      partnerApi.createCourtBlockBulk(id, { ...values, courtSurfaceId: values.courtSurfaceId || null }),
    onSuccess: async (result) => {
      toast.success(`Đã tạo ${result.created} lịch nghỉ`);
      bulkForm.reset({ courtSurfaceId: "", date: todayIso(), month: todayIso().slice(0, 7), startTime: "06:00", endTime: "23:00", reason: "" });
      setBulkModalOpen(false);
      await refreshBlocks();
    },
    onError: (error: any) => toast.error(error.message || "Không thể tạo lịch nghỉ hàng loạt")
  });
  const toggleSurfaceStatus = useMutation({
    mutationFn: ({ surfaceId, status }: { surfaceId: string; status: "ACTIVE" | "INACTIVE" }) => partnerApi.updateCourtSurfaceStatus(id, surfaceId, status),
    onSuccess: async () => {
      toast.success("Đã cập nhật trạng thái sân con");
      await refresh();
    },
    onError: (error: any) => toast.error(error.message || "Không thể cập nhật trạng thái sân con")
  });

  const savePrice = useMutation({
    mutationFn: (values: PriceForm) => editingId ? partnerApi.updatePrice(editingId, values) : partnerApi.addPrice(id, values),
    onSuccess: async () => { toast.success("Đã lưu bảng giá"); setEditingId(null); setManualPriceOpen(false); priceForm.reset(); await refresh(); },
    onError: (error) => toast.error(error.message)
  });
  const quickAddPrice = useMutation({
    mutationFn: (values: { dayType: string; startTime: string; endTime: string; price: number }) => partnerApi.addPrice(id, values),
    onError: (error: any) => toast.error(error.message || "Không thể thêm giá")
  });
  const saveService = useMutation({
    mutationFn: (values: ServiceForm) => editingId ? partnerApi.updateService(editingId, values) : partnerApi.addService(id, values),
    onSuccess: async () => { toast.success("Đã lưu dịch vụ"); setEditingId(null); setServiceFormOpen(false); serviceForm.reset({ price: 0, status: "ACTIVE" }); await refresh(); },
    onError: (error) => toast.error(error.message)
  });
  const toggleServiceStatus = useMutation({
    mutationFn: ({ serviceId, status }: { serviceId: string; status: "ACTIVE" | "INACTIVE" }) => partnerApi.updateService(serviceId, { status }),
    onSuccess: async () => { toast.success("Đã cập nhật trạng thái dịch vụ"); await refresh(); },
    onError: (error: any) => toast.error(error.message || "Không thể cập nhật trạng thái")
  });
  const remove = useMutation({
    mutationFn: ({ type, resourceId }: { type: "price" | "service" | "image"; resourceId: string }) =>
      type === "price" ? partnerApi.deletePrice(resourceId) : type === "service" ? partnerApi.deleteService(resourceId) : partnerApi.deleteCourtImage(resourceId),
    onSuccess: refresh,
    onError: (error) => toast.error(error.message)
  });
  const reorder = useMutation({
    mutationFn: partnerApi.reorderCourtImages.bind(null, id),
    onSuccess: refresh
  });
  const uploadImages = useMutation({
    mutationFn: ({ files, baseOrder }: { files: File[]; baseOrder: number }) =>
      Promise.all(files.map((file, index) => partnerApi.addCourtImage(id, file, baseOrder + index))),
    onSuccess: async (_result, { files }) => { toast.success(`Đã tải lên ${files.length} ảnh`); await refresh(); },
    onError: (error: any) => toast.error(error.message || "Không thể tải ảnh lên")
  });

  if (court.isLoading) return <LoadingState />;
  if (court.isError) return <ErrorState message={court.error.message} />;
  const data = court.data!;

  const moveImage = (index: number, offset: number) => {
    const ids = data.images.map((image) => image.id);
    const target = index + offset;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate(ids);
  };

  const handleImageFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const maxSize = 3 * 1024 * 1024;
    const files = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
    const oversized = files.filter((file) => file.size > maxSize);
    const valid = files.filter((file) => file.size <= maxSize);
    if (oversized.length) toast.error(`${oversized.length} ảnh vượt quá 3MB, đã bỏ qua`);
    if (!valid.length) return;
    uploadImages.mutate({ files: valid, baseOrder: data.images.length });
  };

  const toggleSlot = (surfaceId: string, slot: PartnerBlockSelection) => {
    setSelection((current) => {
      if (!current || current.surfaceId !== surfaceId) return { surfaceId, slots: [slot] };
      const exists = current.slots.some((item) => item.startTime === slot.startTime && item.endTime === slot.endTime);
      const slots = exists ? current.slots.filter((item) => item.startTime !== slot.startTime) : [...current.slots, slot];
      return slots.length ? { surfaceId, slots } : null;
    });
  };

  const togglePriceSlot = (dayType: string, slot: PartnerBlockSelection) => {
    setPriceSelection((current) => {
      if (!current || current.dayType !== dayType) return { dayType, slots: [slot] };
      const exists = current.slots.some((item) => item.startTime === slot.startTime && item.endTime === slot.endTime);
      const slots = exists ? current.slots.filter((item) => item.startTime !== slot.startTime) : [...current.slots, slot];
      return slots.length ? { dayType, slots } : null;
    });
  };

  const submitPriceSelection = async () => {
    if (!priceSelection) return;
    const price = Number(priceQuickValue);
    if (!price || price <= 0) {
      toast.error("Nhập giá hợp lệ trước khi thêm");
      return;
    }
    const groups = mergeContiguousSlots(priceSelection.slots);
    try {
      await Promise.all(
        groups.map((group) => quickAddPrice.mutateAsync({ dayType: priceSelection.dayType, startTime: group.startTime, endTime: group.endTime, price }))
      );
      toast.success(`Đã thêm ${groups.length} mức giá`);
      setPriceQuickValue("");
      setPriceSelection(null);
      await refresh();
    } catch {
      // per-mutation onError already toasts
    }
  };

  const copyPriceRow = async (sourceDayType: string, targetDayType: string) => {
    const source = (data.prices ?? []).filter((p) => p.dayType === sourceDayType);
    const target = (data.prices ?? []).filter((p) => p.dayType === targetDayType);
    const overlaps = (a: { startTime: string; endTime: string }, b: { startTime: string; endTime: string }) =>
      timeText(a.startTime) < timeText(b.endTime) && timeText(a.endTime) > timeText(b.startTime);
    const toCopy = source.filter((rule) => !target.some((existing) => overlaps(rule, existing)));
    if (!toCopy.length) {
      toast.error("Không có mức giá nào để sao chép (đã trùng hết)");
      return;
    }
    try {
      await Promise.all(
        toCopy.map((rule) => quickAddPrice.mutateAsync({ dayType: targetDayType, startTime: timeText(rule.startTime), endTime: timeText(rule.endTime), price: Number(rule.price) }))
      );
      const skipped = source.length - toCopy.length;
      toast.success(`Đã sao chép ${toCopy.length} mức giá${skipped ? `, bỏ qua ${skipped} khung giờ đã có giá` : ""}`);
      await refresh();
    } catch {
      // per-mutation onError already toasts
    }
  };

  const submitSelectionBlock = async () => {
    if (!selection) return;
    const groups = mergeContiguousSlots(selection.slots);
    try {
      await Promise.all(
        groups.map((group) =>
          createBlock.mutateAsync({ courtSurfaceId: selection.surfaceId, blockDate: gridDate, startTime: group.startTime, endTime: group.endTime, reason: selectReason || undefined })
        )
      );
      toast.success(`Đã chặn ${groups.length} khung giờ`);
      setSelectReason("");
      await refreshBlocks();
    } catch {
      // per-mutation onError already toasts
    }
  };

  const toggleWeekday = (value: number) => {
    setBulkWeekdays((current) => (current.includes(value) ? current.filter((v) => v !== value) : [...current, value]));
  };

  const submitBulkBlock = bulkForm.handleSubmit((values) => {
    if (!bulkWeekdays.length) {
      toast.error("Chọn ít nhất 1 thứ trong tuần");
      return;
    }
    let startDate = values.date;
    let endDate = values.date;
    let weekdays: number[] | undefined;
    if (bulkMode === "day") {
      weekdays = undefined;
    } else if (bulkMode === "week") {
      startDate = mondayOf(values.date);
      endDate = addDaysIso(startDate, 6);
      weekdays = bulkWeekdays;
    } else {
      const range = monthRange(values.month);
      startDate = range.start;
      endDate = range.end;
      weekdays = bulkWeekdays;
    }
    bulkBlock.mutate({ ...values, startDate, endDate, weekdays: weekdays as any });
  });

  const surfaceLookup = new Map((data.surfaces ?? []).map((surface) => [surface.id, surface]));

  // TODO(backend): CourtSurface has no per-surface operating hours field yet, so every
  // row mocks the court cluster's openingTime/closingTime. Swap this for the real
  // per-surface value once the backend adds it — CourtScheduleGrid already renders
  // each row's operatingHours independently.
  const scheduleRows: ScheduleRow[] = (grid.data ?? []).map((surface) => ({
    surfaceId: surface.surfaceId,
    surfaceName: surface.surfaceName,
    code: surface.code,
    status: surface.status,
    operatingHours: { open: timeText(data.openingTime), close: timeText(data.closingTime) },
    slots: surface.slots
  }));

  const priceRows: PriceScheduleRow[] = [
    { dayType: "WEEKDAY", label: "Ngày thường" },
    { dayType: "WEEKEND", label: "Cuối tuần" },
    { dayType: "HOLIDAY", label: "Ngày lễ" }
  ].map(({ dayType, label }) => ({
    dayType,
    label,
    rules: (data.prices ?? [])
      .filter((p) => p.dayType === dayType)
      .map((p) => ({ id: p.id, startTime: timeText(p.startTime), endTime: timeText(p.endTime), price: Number(p.price) }))
  }));

  const handlePricedCellClick = (dayType: string, rule: PriceRule, anchor: PopoverAnchor) => {
    setPriceCellPopover({ dayType, rule, anchor });
  };

  const handleBlockedCellClick = (surfaceId: string, slot: PartnerSurfaceSlot, anchor: PopoverAnchor) => {
    setUnblockTarget({ surfaceId, slot, anchor });
  };

  return (
    <div className="space-y-5">
      <Link
        to="/partner/courts"
        className="group inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-action"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
        Quay lại danh sách sân
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-3xl font-bold">{mode === "prices" ? "Bảng giá" : mode === "services" ? "Dịch vụ đi kèm" : mode === "images" ? "Hình ảnh sân" : "Lịch nghỉ / bảo trì"}</h1><p className="text-slate-600">{data.name}</p></div>
        <div className="inline-flex flex-wrap gap-1 rounded-full bg-slate-100 p-1">
          {(
            [
              { key: "prices", label: "Bảng giá", icon: Tag },
              { key: "services", label: "Dịch vụ", icon: Sparkles },
              { key: "images", label: "Ảnh", icon: Star },
              { key: "blocks", label: "Lịch nghỉ", icon: CalendarClock }
            ] as const
          ).map((tab) => (
            <Link key={tab.key} to={`/partner/courts/${id}/${tab.key}`}>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-bold transition ${mode === tab.key ? "bg-white text-ink shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {mode === "prices" && (
        <>
          <PriceScheduleGrid
            rows={priceRows}
            operatingHours={{ open: timeText(data.openingTime), close: timeText(data.closingTime) }}
            selection={priceSelection}
            onToggleSelect={togglePriceSlot}
            onPricedCellClick={handlePricedCellClick}
            onCopyRow={copyPriceRow}
          />

          {priceSelection && priceSelection.slots.length > 0 && (
            <div className="sticky bottom-4 z-40 flex flex-wrap items-center gap-3 rounded-xl border border-teal-200 bg-teal-50/95 p-3 shadow-lg backdrop-blur">
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-teal-800">
                <Tag className="h-4 w-4 shrink-0" />
                {priceRows.find((r) => r.dayType === priceSelection.dayType)?.label} · Đã chọn {priceSelection.slots.length} khung giờ
              </span>
              <Input className="w-40" type="number" min={0} placeholder="Giá (đ)" value={priceQuickValue} onChange={(e) => setPriceQuickValue(e.target.value)} />
              <Button disabled={quickAddPrice.isPending} onClick={submitPriceSelection}>{quickAddPrice.isPending ? "Đang thêm..." : "Thêm giá"}</Button>
              <Button variant="secondary" onClick={() => setPriceSelection(null)}>Bỏ chọn</Button>
            </div>
          )}

          <div className="rounded-2xl border border-line bg-white">
            <button type="button" className="flex w-full items-center justify-between p-4 text-left" onClick={() => setManualPriceOpen((v) => !v)}>
              <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-500">
                <Pencil className="h-3.5 w-3.5" />
                {editingId ? "Sửa mức giá (giờ lẻ / ghi chú)" : "Thêm thủ công (giờ lẻ / ghi chú)"}
              </span>
              {manualPriceOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {manualPriceOpen && (
              <form className="grid gap-3 border-t border-line p-5 md:grid-cols-5" onSubmit={priceForm.handleSubmit((v) => savePrice.mutate(v))}>
                <Select label="Loại ngày" options={[{ value: "WEEKDAY", label: "Ngày thường" }, { value: "WEEKEND", label: "Cuối tuần" }, { value: "HOLIDAY", label: "Ngày lễ" }]} {...priceForm.register("dayType")} />
                <Input label="Từ giờ" type="time" {...priceForm.register("startTime", { required: true })} />
                <Input label="Đến giờ" type="time" {...priceForm.register("endTime", { required: true })} />
                <Input label="Giá (đ)" type="number" {...priceForm.register("price", { valueAsNumber: true, min: 0 })} />
                <div className="flex items-end gap-2">
                  <Button className="w-full">{editingId ? "Cập nhật" : "Thêm giá"}</Button>
                  {editingId && (
                    <Button type="button" variant="secondary" onClick={() => { setEditingId(null); priceForm.reset({ dayType: "WEEKDAY", startTime: "06:00", endTime: "07:00", price: 0 }); }}>
                      Hủy
                    </Button>
                  )}
                </div>
              </form>
            )}
          </div>

          {data.prices.length === 0 ? (
            <EmptyState title="Chưa có bảng giá nào." description="Chọn khung giờ trên lưới hoặc dùng form thủ công để thêm mức giá đầu tiên." />
          ) : (
            <div className="rounded-2xl border border-line bg-white">
              <button type="button" className="flex w-full items-center justify-between p-4 text-left" onClick={() => setPriceListOpen((v) => !v)}>
                <span className="text-sm font-bold text-slate-500">Xem tất cả mức giá ({data.prices.length})</span>
                {priceListOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {priceListOpen &&
                data.prices.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5 transition hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${dayTypeTone[item.dayType] ?? "bg-slate-100 text-slate-600"}`}>
                        {dayTypeLabel[item.dayType] ?? item.dayType}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
                        <Clock3 className="h-3.5 w-3.5" />
                        {timeText(item.startTime)} - {timeText(item.endTime)}
                      </span>
                      <span className="text-sm font-black text-ink">{Number(item.price).toLocaleString("vi-VN")} đ</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        title="Sửa"
                        onClick={() => { setEditingId(item.id); setManualPriceOpen(true); priceForm.reset({ dayType: item.dayType, startTime: timeText(item.startTime), endTime: timeText(item.endTime), price: Number(item.price), note: item.note }); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="rounded-full p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        title="Xóa"
                        onClick={() => setRemoveTarget({ type: "price", resourceId: item.id })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </>
      )}

      {mode === "services" && (
        <>
          <div className="rounded-2xl border border-line bg-white">
            <button
              type="button"
              className="flex w-full items-center justify-between p-4 text-left"
              onClick={() => {
                if (serviceFormOpen && editingId) { setEditingId(null); serviceForm.reset({ price: 0, status: "ACTIVE" }); }
                setServiceFormOpen((v) => !v);
              }}
            >
              <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-500">
                <Sparkles className="h-3.5 w-3.5" />
                {editingId ? "Cập nhật dịch vụ" : "Thêm dịch vụ đi kèm"}
              </span>
              {serviceFormOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {serviceFormOpen && (
              <form className="grid gap-3 border-t border-line p-5 md:grid-cols-2" onSubmit={serviceForm.handleSubmit((v) => saveService.mutate(v))}>
                <Input label="Tên dịch vụ" {...serviceForm.register("name", { required: true })} />
                <Input label="Giá (đ)" type="number" {...serviceForm.register("price", { valueAsNumber: true, min: 0 })} />
                <Input className="md:col-span-2" label="Mô tả (không bắt buộc)" placeholder="Vd: Vợt Yonex chính hãng, đủ size" {...serviceForm.register("description")} />
                <Select label="Trạng thái" options={[{ value: "ACTIVE", label: "Hoạt động" }, { value: "INACTIVE", label: "Tạm ẩn" }]} {...serviceForm.register("status")} />
                <div className="flex items-end gap-2">
                  <Button className="w-full">{editingId ? "Cập nhật" : "Thêm dịch vụ"}</Button>
                  {editingId && (
                    <Button type="button" variant="secondary" onClick={() => { setEditingId(null); serviceForm.reset({ price: 0, status: "ACTIVE" }); }}>
                      Hủy
                    </Button>
                  )}
                </div>
              </form>
            )}
          </div>

          {data.services.length === 0 ? (
            <EmptyState title="Chưa có dịch vụ đi kèm nào." description={'Bấm "Thêm dịch vụ đi kèm" ở trên (nước uống, thuê vợt, áo bib...) để khách hàng chọn thêm khi đặt sân.'} />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line bg-white">
              {[...data.services].sort((a, b) => (a.status === b.status ? 0 : a.status === "ACTIVE" ? -1 : 1)).map((item) => (
                <div key={item.id} className={clsx("flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5 transition last:border-0 hover:bg-slate-50", item.status !== "ACTIVE" && "opacity-60")}>
                  <div className="flex min-w-0 items-center gap-3">
                    <Sparkles className="h-4 w-4 shrink-0 text-slate-300" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-ink">{item.name}</span>
                        <span className="text-sm font-black text-emerald-700">{Number(item.price).toLocaleString("vi-VN")} đ</span>
                      </div>
                      {item.description && <p className="truncate text-sm text-slate-500">{item.description}</p>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      disabled={toggleServiceStatus.isPending}
                      className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${serviceStatusTone[item.status] ?? "bg-slate-100 text-slate-600"} hover:brightness-95`}
                      title={item.status === "ACTIVE" ? "Bấm để ẩn dịch vụ" : "Bấm để kích hoạt lại"}
                      onClick={() =>
                        item.status === "ACTIVE"
                          ? setRemoveTarget({ type: "service", resourceId: item.id })
                          : toggleServiceStatus.mutate({ serviceId: item.id, status: "ACTIVE" })
                      }
                    >
                      {serviceStatusLabel[item.status] ?? item.status}
                    </button>
                    <button
                      type="button"
                      className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      title="Sửa"
                      onClick={() => { setEditingId(item.id); setServiceFormOpen(true); serviceForm.reset({ name: item.name, description: item.description, price: Number(item.price), status: item.status }); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {mode === "images" && (
        <>
          <p className="text-sm text-slate-500">Ảnh đầu tiên là ảnh đại diện khách hàng thấy khi tìm kiếm — kéo thả hoặc bấm vào ô bên dưới để thêm ảnh mới (tối đa 3MB/ảnh).</p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div
              role="button"
              tabIndex={0}
              onClick={() => imageInputRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && imageInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setImageDragOver(true); }}
              onDragLeave={() => setImageDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setImageDragOver(false); handleImageFiles(e.dataTransfer.files); }}
              className={clsx(
                "flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-4 text-center transition",
                imageDragOver ? "border-teal-500 bg-teal-50" : "border-slate-300 bg-slate-50 hover:border-teal-400 hover:bg-teal-50/60"
              )}
            >
              {uploadImages.isPending ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
                  <p className="text-sm font-bold text-teal-700">Đang tải lên...</p>
                </>
              ) : (
                <>
                  <ImagePlus className="h-6 w-6 text-slate-400" />
                  <p className="text-sm font-bold text-slate-600">Thêm ảnh</p>
                  <p className="text-xs text-slate-400">Kéo thả hoặc bấm để chọn</p>
                </>
              )}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { handleImageFiles(e.target.files); e.target.value = ""; }}
              />
            </div>

            {data.images.length === 0 && (
              <div className="col-span-full flex items-center sm:col-auto">
                <EmptyState title="Sân chưa có ảnh nào." description="Ảnh giúp khách hàng nhận diện sân dễ hơn khi tìm kiếm và đặt sân." />
              </div>
            )}

            {data.images.sort((a, b) => a.sortOrder - b.sortOrder).map((image, index) => (
            <div key={image.id} className="group overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition hover:shadow-md">
              <div className="relative aspect-[4/3] overflow-hidden">
                <img className="h-full w-full object-cover transition duration-300 group-hover:scale-105" src={image.imageUrl} alt={data.name} />
                {index === 0 && (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-amber-600 shadow-sm">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    Ảnh đại diện
                  </span>
                )}
                <span className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-xs font-bold text-white">
                  {index + 1}/{data.images.length}
                </span>
              </div>
              <div className="flex items-center justify-between p-3">
                <div className="flex gap-1">
                  <button type="button" disabled={index === 0} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40" title="Đưa lên trước" onClick={() => moveImage(index, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button type="button" disabled={index === data.images.length - 1} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40" title="Đưa xuống sau" onClick={() => moveImage(index, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>
                <button type="button" className="rounded-full p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600" title="Xóa ảnh" onClick={() => setRemoveTarget({ type: "image", resourceId: image.id })}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          </div>
        </>
      )}

      {mode === "blocks" && (
        <>
          <div className="rounded-2xl border border-line bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-bold">Xem &amp; chặn khung giờ theo ngày</p>
                <p className="text-sm text-slate-500">Bấm chọn các khung giờ còn trống để chặn nhanh, hoặc bấm "Tạo lịch nghỉ" để chặn theo ngày/tuần/tháng.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <DateNavigator value={gridDate} onChange={(date) => { setGridDate(date); setSelection(null); }} />
                <Button type="button" onClick={() => setBulkModalOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Tạo lịch nghỉ
                </Button>
              </div>
            </div>
            <div className="border-t border-line px-4 py-3">
              <ScheduleLegend />
            </div>
          </div>

          {!data.surfaces?.length ? (
            <div className="rounded-2xl border border-line bg-white p-4"><EmptyState title="Cụm sân này chưa có sân con nào." /></div>
          ) : grid.isLoading ? (
            <LoadingState />
          ) : grid.isError ? (
            <ErrorState message={grid.error.message} />
          ) : (
            <CourtScheduleGrid
              rows={scheduleRows}
              date={gridDate}
              selection={selection}
              onToggleSelect={toggleSlot}
              onBlockedCellClick={handleBlockedCellClick}
              onToggleSurfaceStatus={(surfaceId, status) => toggleSurfaceStatus.mutate({ surfaceId, status })}
              toggleSurfaceStatusPending={toggleSurfaceStatus.isPending}
            />
          )}

          {selection && selection.slots.length > 0 && (
            <div className="sticky bottom-4 z-40 flex flex-wrap items-center gap-3 rounded-xl border border-teal-200 bg-teal-50/95 p-3 shadow-lg backdrop-blur">
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-teal-800">
                <CalendarClock className="h-4 w-4 shrink-0" />
                {surfaceLookup.get(selection.surfaceId)?.name ?? scheduleRows.find((r) => r.surfaceId === selection.surfaceId)?.surfaceName} · Đã chọn {selection.slots.length} khung giờ
              </span>
              <Input className="min-w-48 flex-1" placeholder="Lý do (không bắt buộc)" value={selectReason} onChange={(e) => setSelectReason(e.target.value)} />
              <Button disabled={createBlock.isPending} onClick={submitSelectionBlock}>{createBlock.isPending ? "Đang chặn..." : "Chặn khung giờ đã chọn"}</Button>
              <Button variant="secondary" onClick={() => setSelection(null)}>Bỏ chọn</Button>
            </div>
          )}

          <BlockHistoryList
            blocks={blocks.data}
            isLoading={blocks.isLoading}
            isError={blocks.isError}
            errorMessage={blocks.error?.message}
            open={historyOpen}
            onToggleOpen={() => setHistoryOpen((v) => !v)}
            onCancel={(blockId) => cancelBlock.mutate(blockId)}
          />

          <BlockTimeRangeModal
            open={bulkModalOpen}
            onClose={() => setBulkModalOpen(false)}
            surfaces={data.surfaces ?? []}
            rows={scheduleRows}
            bulkMode={bulkMode}
            onBulkModeChange={setBulkMode}
            bulkWeekdays={bulkWeekdays}
            onToggleWeekday={toggleWeekday}
            bulkForm={bulkForm}
            onSubmit={submitBulkBlock}
            pending={bulkBlock.isPending}
          />
        </>
      )}

      <ConfirmModal
        open={Boolean(removeTarget)}
        title={removeTarget ? removeConfirmCopy[removeTarget.type].title : ""}
        message={removeTarget ? removeConfirmCopy[removeTarget.type].message : ""}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => removeTarget && remove.mutate(removeTarget)}
      />

      <SlotActionPopover
        anchor={unblockTarget?.anchor ?? null}
        title={
          unblockTarget
            ? `${surfaceLookup.get(unblockTarget.surfaceId)?.name ?? scheduleRows.find((r) => r.surfaceId === unblockTarget.surfaceId)?.surfaceName ?? ""} · ${unblockTarget.slot.startTime}-${unblockTarget.slot.endTime}`
            : ""
        }
        reason={unblockTarget?.slot.status === "BLOCKED" ? blocks.data?.find((b) => b.id === unblockTarget.slot.blockId)?.reason : undefined}
        confirmLabel="Hủy chặn"
        pending={cancelBlock.isPending}
        onClose={() => setUnblockTarget(null)}
        onConfirm={() => unblockTarget?.slot.blockId && cancelBlock.mutate(unblockTarget.slot.blockId)}
      />

      <PricePopover
        anchor={priceCellPopover?.anchor ?? null}
        title={
          priceCellPopover
            ? `${priceRows.find((r) => r.dayType === priceCellPopover.dayType)?.label} · ${priceCellPopover.rule.startTime}-${priceCellPopover.rule.endTime}`
            : ""
        }
        priceLabel={priceCellPopover ? `${priceCellPopover.rule.price.toLocaleString("vi-VN")} đ` : ""}
        pending={remove.isPending}
        onClose={() => setPriceCellPopover(null)}
        onEdit={() => {
          if (!priceCellPopover) return;
          setEditingId(priceCellPopover.rule.id);
          setManualPriceOpen(true);
          priceForm.reset({ dayType: priceCellPopover.dayType, startTime: priceCellPopover.rule.startTime, endTime: priceCellPopover.rule.endTime, price: priceCellPopover.rule.price });
          setPriceCellPopover(null);
        }}
        onDelete={() => {
          if (!priceCellPopover) return;
          setRemoveTarget({ type: "price", resourceId: priceCellPopover.rule.id });
          setPriceCellPopover(null);
        }}
      />
    </div>
  );
}
