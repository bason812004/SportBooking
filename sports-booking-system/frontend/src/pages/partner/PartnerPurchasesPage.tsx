import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Truck, Plus, ShoppingCart, UserCheck, Pencil, Send, PackageCheck, XCircle, Sparkles, MapPin } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import {
  inventoryApi,
  type PurchaseOrder,
  type PurchaseOrderPerson,
  type PurchaseOrderStatus,
  type Supplier
} from "../../features/inventory/api/inventoryApi";
import { serviceApi, type ServiceItem } from "../../features/services/api/serviceApi";
import { partnerApi } from "../../features/partner/api/partnerApi";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { formatMoney } from "../../utils/formatters";

type PoItemForm = { serviceId: string; quantity: number; unitCost: number };
type PoAction = "order" | "cancel";
type StatusFilter = "ALL" | PurchaseOrderStatus;

const STATUS_META: Record<PurchaseOrderStatus, { label: string; className: string }> = {
  DRAFT: { label: "Nháp – chờ duyệt", className: "bg-slate-100 text-slate-700" },
  ORDERED: { label: "Đã đặt hàng – chờ nhận", className: "bg-amber-100 text-amber-800" },
  COMPLETED: { label: "Đã nhận (đã cộng kho)", className: "bg-emerald-100 text-emerald-800" },
  CANCELLED: { label: "Đã hủy", className: "bg-rose-100 text-rose-700" }
};

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "ALL", label: "Tất cả" },
  { value: "DRAFT", label: "Nháp / chờ duyệt" },
  { value: "ORDERED", label: "Đã đặt hàng" },
  { value: "COMPLETED", label: "Đã nhận" },
  { value: "CANCELLED", label: "Đã hủy" }
];

const ACTION_COPY: Record<PoAction, { success: string; confirm?: string }> = {
  order: { success: "Đã duyệt và đặt hàng. Lễ tân cụm sân sẽ xác nhận khi hàng về." },
  cancel: { success: "Đã hủy đơn nhập hàng.", confirm: "Hủy đơn nhập hàng này? Tồn kho sẽ không thay đổi." }
};

// Validation errors carry a generic message; the actual reason ("Số lượng nhập phải lớn hơn 0") is in `errors`.
function errorMessage(err: any, fallback: string) {
  const data = err?.response?.data;
  const firstFieldError = Object.values((data?.errors ?? {}) as Record<string, string[]>).flat()[0];
  return firstFieldError || data?.message || fallback;
}

const formatTime = (value?: string | null) => (value ? new Date(value).toLocaleString("vi-VN") : "");
const serviceCourtId = (svc: ServiceItem) => svc.courtId ?? svc.court?.id ?? null;

export function PartnerPurchasesPage() {
  const queryClient = useQueryClient();
  // Also mounted at /recipient/purchases: a receptionist proposes drafts and counts goods in for their own
  // court; approving/ordering, suppliers and other courts stay with the partner. The server enforces this too.
  const { user } = useAuth();
  const isPartner = user?.role === "PARTNER";

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"ORDERS" | "SUPPLIERS">("ORDERS");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [courtFilter, setCourtFilter] = useState("");
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [creatingDraft, setCreatingDraft] = useState(false);

  // /partner/courts is partner-only; a receptionist's court comes from their (server-scoped) products.
  const courtsQuery = useQuery({ queryKey: ["partner-courts"], queryFn: partnerApi.courts, enabled: isPartner });
  const courts = courtsQuery.data ?? [];
  const ownCourtName = services.find((svc) => svc.court?.name)?.court?.name ?? purchaseOrders[0]?.court?.name ?? null;

  // Supplier Modal
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: "", contactName: "", phone: "", email: "", address: "" });

  // PO Modal (create, or edit while the order is still a draft)
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);
  const [editingPoId, setEditingPoId] = useState<string | null>(null);
  const [savingPO, setSavingPO] = useState(false);
  const [poCourtId, setPoCourtId] = useState("");
  const [poSupplierId, setPoSupplierId] = useState("");
  const [poNote, setPoNote] = useState("");
  const [poItems, setPoItems] = useState<PoItemForm[]>([]);

  // Receive Modal: counting what actually arrived
  const [receiveTarget, setReceiveTarget] = useState<PurchaseOrder | null>(null);
  const [receivedCounts, setReceivedCounts] = useState<Record<string, number>>({});
  const [receiveNote, setReceiveNote] = useState("");
  const [savingReceipt, setSavingReceipt] = useState(false);

  const [detailTarget, setDetailTarget] = useState<PurchaseOrder | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [supList, poList, svcList] = await Promise.all([
        inventoryApi.getSuppliers(),
        inventoryApi.getPurchaseOrders({ courtId: isPartner && courtFilter ? courtFilter : undefined }),
        serviceApi.getPartnerServices()
      ]);
      setSuppliers(supList);
      setPurchaseOrders(poList);
      setServices(svcList);
    } catch (err) {
      console.error("Failed to load purchases:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [courtFilter]);

  // Receiving goods changes stock, cost price and reorder suggestions shown on the inventory page.
  const refreshAfterStockChange = () => {
    fetchData();
    queryClient.invalidateQueries({ queryKey: ["partner-inventory"] });
    queryClient.invalidateQueries({ queryKey: ["inventory-transactions"] });
    queryClient.invalidateQueries({ queryKey: ["inventory-suggestions"] });
  };

  // Products of the court being restocked: each court keeps its own rows and stock.
  const servicesForCourt = isPartner ? services.filter((svc) => serviceCourtId(svc) === poCourtId) : services;
  const firstLine = (list: ServiceItem[]): PoItemForm[] =>
    list.length > 0 ? [{ serviceId: list[0].id, quantity: 10, unitCost: list[0].costPrice || 0 }] : [];

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await inventoryApi.createSupplier(supplierForm);
      setIsSupplierModalOpen(false);
      setSupplierForm({ name: "", contactName: "", phone: "", email: "", address: "" });
      toast.success("Đã thêm nhà cung cấp.");
      fetchData();
    } catch (err: any) {
      toast.error(errorMessage(err, "Lỗi tạo nhà cung cấp"));
    }
  };

  const openCreatePO = () => {
    const courtId = isPartner ? courtFilter : "";
    setEditingPoId(null);
    setPoCourtId(courtId);
    setPoSupplierId("");
    setPoNote("");
    setPoItems(firstLine(isPartner ? services.filter((svc) => serviceCourtId(svc) === courtId) : services));
    setIsPOModalOpen(true);
  };

  const openEditPO = (po: PurchaseOrder) => {
    setEditingPoId(po.id);
    setPoCourtId(po.courtId ?? "");
    setPoSupplierId(po.supplierId ?? "");
    setPoNote(po.note ?? "");
    // Decimal columns arrive as strings in JSON.
    setPoItems(po.items.map((item) => ({ serviceId: item.serviceId, quantity: Number(item.quantity), unitCost: Number(item.unitCost) })));
    setIsPOModalOpen(true);
  };

  // Lines belong to one court, so switching court starts the list over with that court's products.
  const handleChangePoCourt = (courtId: string) => {
    setPoCourtId(courtId);
    setPoItems(firstLine(services.filter((svc) => serviceCourtId(svc) === courtId)));
  };

  const handleAddPOItem = () => {
    if (servicesForCourt.length === 0) return;
    setPoItems([...poItems, ...firstLine(servicesForCourt)]);
  };

  const handleRemovePOItem = (index: number) => {
    setPoItems(poItems.filter((_, i) => i !== index));
  };

  const handleUpdatePOItem = (index: number, field: string, value: any) => {
    const next = [...poItems];
    if (field === "serviceId") {
      const svc = services.find((s) => s.id === value);
      next[index] = { ...next[index], serviceId: value, unitCost: svc?.costPrice || 0 };
    } else {
      next[index] = { ...next[index], [field]: value };
    }
    setPoItems(next);
  };

  // The modal has one submit button per target status ("Lưu nháp" / "Đặt hàng" / "Nhập kho ngay").
  const handleSavePO = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPartner && !poCourtId) {
      toast.error("Vui lòng chọn cụm sân cần nhập hàng");
      return;
    }
    if (poItems.length === 0) {
      toast.error("Vui lòng thêm ít nhất 1 sản phẩm vào đơn nhập hàng");
      return;
    }
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const status = (submitter?.value || "DRAFT") as Exclude<PurchaseOrderStatus, "CANCELLED">;
    const payload = {
      supplierId: poSupplierId || undefined,
      note: poNote,
      items: poItems.map((item) => ({
        serviceId: item.serviceId,
        quantity: Number(item.quantity),
        unitCost: Number(item.unitCost)
      }))
    };

    setSavingPO(true);
    try {
      if (editingPoId) {
        await inventoryApi.updatePurchaseOrder(editingPoId, payload);
        toast.success("Đã cập nhật đơn nháp.");
      } else {
        const po = await inventoryApi.createPurchaseOrder({ ...payload, courtId: isPartner ? poCourtId : undefined, status });
        toast.success(
          !isPartner
            ? `Đã gửi đề xuất ${po.orderCode} cho đối tác duyệt.`
            : status === "COMPLETED"
            ? `Đã nhập kho đơn ${po.orderCode}.`
            : status === "ORDERED"
            ? `Đã tạo đơn đặt hàng ${po.orderCode}.`
            : `Đã lưu nháp đơn ${po.orderCode}.`
        );
      }
      setIsPOModalOpen(false);
      setPoItems([]);
      setPoNote("");
      if (status === "COMPLETED" && !editingPoId) refreshAfterStockChange();
      else fetchData();
    } catch (err: any) {
      toast.error(errorMessage(err, "Lỗi lưu đơn nhập hàng"));
    } finally {
      setSavingPO(false);
    }
  };

  const handleDraftFromSuggestions = async () => {
    setCreatingDraft(true);
    try {
      const po = await inventoryApi.createDraftFromSuggestions(isPartner ? courtFilter : undefined);
      toast.success(`Đã tạo đơn nháp ${po.orderCode} từ ${po.items.length} gợi ý. Kiểm tra lại số lượng rồi lưu.`);
      fetchData();
      openEditPO(po);
    } catch (err: any) {
      toast.error(errorMessage(err, "Không thể tạo đơn nháp từ gợi ý"));
    } finally {
      setCreatingDraft(false);
    }
  };

  const runAction = async (po: PurchaseOrder, action: PoAction) => {
    const copy = ACTION_COPY[action];
    if (copy.confirm && !window.confirm(`${po.orderCode}: ${copy.confirm}`)) return;
    setBusyOrderId(po.id);
    try {
      if (action === "order") await inventoryApi.orderPurchaseOrder(po.id);
      if (action === "cancel") await inventoryApi.cancelPurchaseOrder(po.id);
      toast.success(copy.success);
      fetchData();
    } catch (err: any) {
      toast.error(errorMessage(err, "Không thể cập nhật đơn nhập hàng"));
      // The order may have moved on in another tab; show its real state.
      fetchData();
    } finally {
      setBusyOrderId(null);
    }
  };

  const openReceive = (po: PurchaseOrder) => {
    setReceiveTarget(po);
    setReceivedCounts(Object.fromEntries(po.items.map((item) => [item.id, Number(item.quantity)])));
    setReceiveNote("");
  };

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveTarget) return;
    setSavingReceipt(true);
    try {
      await inventoryApi.receivePurchaseOrder(receiveTarget.id, {
        items: receiveTarget.items.map((item) => ({ itemId: item.id, receivedQuantity: Number(receivedCounts[item.id] ?? 0) })),
        note: receiveNote || undefined
      });
      toast.success(`Đã nhận hàng đơn ${receiveTarget.orderCode} và cộng tồn kho theo số thực nhận.`);
      setReceiveTarget(null);
      refreshAfterStockChange();
    } catch (err: any) {
      toast.error(errorMessage(err, "Không thể xác nhận nhận hàng"));
      fetchData();
    } finally {
      setSavingReceipt(false);
    }
  };

  const calculatePOTotal = () => {
    return poItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0), 0);
  };

  const receiveLines = receiveTarget?.items ?? [];
  const shortLines = receiveLines.filter((item) => Number(receivedCounts[item.id] ?? 0) < Number(item.quantity)).length;
  const receivedTotal = receiveLines.reduce((sum, item) => sum + Number(receivedCounts[item.id] ?? 0) * Number(item.unitCost), 0);

  const countByStatus = (status: StatusFilter) =>
    status === "ALL" ? purchaseOrders.length : purchaseOrders.filter((po) => po.status === status).length;
  const visibleOrders = statusFilter === "ALL" ? purchaseOrders : purchaseOrders.filter((po) => po.status === statusFilter);
  const columnCount = isPartner ? 9 : 8;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Quản Lý Nhập Hàng & Nhà Cung Cấp</h1>
          <p className="text-sm font-medium text-slate-600">
            {isPartner
              ? "Mỗi cụm sân nhập hàng riêng: lễ tân đề xuất, bạn duyệt đặt hàng, lễ tân kiểm đếm khi hàng về."
              : "Đề xuất nhập hàng cho cụm sân của bạn và xác nhận số lượng thực nhận khi hàng về."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            className="flex items-center gap-2"
            disabled={creatingDraft || (isPartner && !courtFilter)}
            title={isPartner && !courtFilter ? "Chọn một cụm sân ở bộ lọc trước" : undefined}
            onClick={handleDraftFromSuggestions}
          >
            <Sparkles className="h-4 w-4" /> Tạo nháp từ gợi ý
          </Button>
          {isPartner ? (
            <Button variant="secondary" className="flex items-center gap-2" onClick={() => setIsSupplierModalOpen(true)}>
              <UserCheck className="h-4 w-4" /> Thêm NCC
            </Button>
          ) : null}
          <Button className="flex items-center gap-2 bg-[#02712a] text-white" onClick={openCreatePO}>
            <Plus className="h-4 w-4" /> {isPartner ? "Nhập hàng mới" : "Đề xuất nhập hàng"}
          </Button>
        </div>
      </div>

      {isPartner ? (
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-bold uppercase text-slate-700">Cụm sân</label>
          <select
            className="min-w-[220px] rounded-xl border border-slate-300 p-2.5 text-sm font-semibold focus:border-green-600 focus:outline-none"
            value={courtFilter}
            onChange={(e) => setCourtFilter(e.target.value)}
          >
            <option value="">Tất cả cụm sân</option>
            {courts.map((court) => (
              <option key={court.id} value={court.id}>
                {court.name}
              </option>
            ))}
          </select>
        </div>
      ) : ownCourtName ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-[#02712a]">
          <MapPin className="h-4 w-4" /> Cụm sân của bạn: {ownCourtName}
        </div>
      ) : null}

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("ORDERS")}
          className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-bold transition ${
            activeTab === "ORDERS"
              ? "border-[#02712a] text-[#02712a]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <ShoppingCart className="h-4 w-4" /> Đơn nhập hàng ({purchaseOrders.length})
        </button>
        <button
          onClick={() => setActiveTab("SUPPLIERS")}
          className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-bold transition ${
            activeTab === "SUPPLIERS"
              ? "border-[#02712a] text-[#02712a]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Truck className="h-4 w-4" /> Nhà cung cấp ({suppliers.length})
        </button>
      </div>

      {activeTab === "ORDERS" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  statusFilter === filter.value
                    ? "border-[#02712a] bg-[#02712a] text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {filter.label} ({countByStatus(filter.value)})
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs uppercase font-extrabold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-4">Mã đơn</th>
                  {isPartner ? <th className="p-4">Cụm sân</th> : null}
                  <th className="p-4">Ngày tạo</th>
                  <th className="p-4">Nhà cung cấp</th>
                  <th className="p-4">Số sản phẩm</th>
                  <th className="p-4">Tổng tiền vốn</th>
                  <th className="p-4">Trạng thái</th>
                  <th className="p-4">Ghi chú</th>
                  <th className="p-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold">
                {loading && purchaseOrders.length === 0 ? (
                  <tr>
                    <td colSpan={columnCount} className="p-8 text-center text-slate-500 font-normal">
                      Đang tải đơn nhập hàng...
                    </td>
                  </tr>
                ) : visibleOrders.length === 0 ? (
                  <tr>
                    <td colSpan={columnCount} className="p-8 text-center text-slate-500 font-normal">
                      {purchaseOrders.length === 0 ? "Chưa có đơn nhập hàng nào" : "Không có đơn nào ở trạng thái này"}
                    </td>
                  </tr>
                ) : (
                  visibleOrders.map((po) => {
                    const meta = STATUS_META[po.status] ?? { label: po.status, className: "bg-slate-100 text-slate-700" };
                    const finishedAt = po.status === "COMPLETED" ? po.receivedAt ?? po.updatedAt : po.status === "CANCELLED" ? po.cancelledAt ?? po.updatedAt : null;
                    const shortfall = po.status === "COMPLETED" && po.receivedAmount != null && Number(po.receivedAmount) !== Number(po.totalAmount);
                    const busy = busyOrderId === po.id;
                    const proposedByStaff = po.createdBy?.id !== undefined && po.createdBy.id !== user?.id;
                    return (
                      <tr key={po.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-4">
                          <button type="button" className="font-extrabold text-[#02712a] hover:underline" onClick={() => setDetailTarget(po)}>
                            {po.orderCode}
                          </button>
                        </td>
                        {isPartner ? <td className="p-4 text-xs font-bold text-slate-700">{po.court?.name ?? "—"}</td> : null}
                        <td className="p-4 text-xs text-slate-500">
                          {formatTime(po.createdAt)}
                          {po.createdBy ? <p className="text-[11px] text-slate-400">bởi {po.createdBy.fullName}</p> : null}
                        </td>
                        <td className="p-4 font-bold text-slate-900">{po.supplier?.name || "Nhập lẻ / Tự do"}</td>
                        <td className="p-4">{po.items?.length || 0} mặt hàng</td>
                        <td className="p-4 font-extrabold text-slate-900 text-base">
                          {formatMoney(po.totalAmount)}
                          {shortfall ? (
                            <p className="text-[11px] font-bold text-amber-700">Thực nhận: {formatMoney(po.receivedAmount)}</p>
                          ) : null}
                        </td>
                        <td className="p-4">
                          <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-extrabold ${meta.className}`}>
                            {meta.label}
                          </span>
                          {finishedAt ? <p className="mt-1 text-[11px] font-medium text-slate-500">{formatTime(finishedAt)}</p> : null}
                        </td>
                        <td className="p-4 text-xs text-slate-500">{po.note || "---"}</td>
                        <td className="p-4">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {po.status === "DRAFT" ? (
                              <Button size="sm" variant="secondary" disabled={busy} onClick={() => openEditPO(po)}>
                                <Pencil className="h-3.5 w-3.5" /> Sửa
                              </Button>
                            ) : null}
                            {isPartner && po.status === "DRAFT" ? (
                              <Button size="sm" variant="secondary" disabled={busy} onClick={() => runAction(po, "order")}>
                                <Send className="h-3.5 w-3.5" /> {proposedByStaff ? "Duyệt & đặt hàng" : "Đặt hàng"}
                              </Button>
                            ) : null}
                            {po.status === "ORDERED" || (isPartner && po.status === "DRAFT") ? (
                              <Button size="sm" className="bg-[#02712a] text-white" disabled={busy} onClick={() => openReceive(po)}>
                                <PackageCheck className="h-3.5 w-3.5" /> Nhận hàng
                              </Button>
                            ) : null}
                            {po.status === "DRAFT" || (isPartner && po.status === "ORDERED") ? (
                              <Button size="sm" variant="ghost" className="text-rose-600" disabled={busy} onClick={() => runAction(po, "cancel")}>
                                <XCircle className="h-3.5 w-3.5" /> {isPartner ? "Hủy" : "Rút đề xuất"}
                              </Button>
                            ) : null}
                            {po.status === "COMPLETED" || po.status === "CANCELLED" ? (
                              <Button size="sm" variant="ghost" onClick={() => setDetailTarget(po)}>
                                Chi tiết
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "SUPPLIERS" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
              Chưa có nhà cung cấp nào. Thêm nhà cung cấp để quản lý nguồn hàng dễ dàng hơn.
            </div>
          ) : (
            suppliers.map((s) => (
              <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-base">{s.name}</h3>
                  <span className="rounded-lg bg-green-50 px-2 py-0.5 text-xs font-bold text-[#02712a]">NCC</span>
                </div>
                {s.contactName && <p className="text-xs text-slate-600">Đại diện: {s.contactName}</p>}
                {s.phone && <p className="text-xs text-slate-600">SĐT: {s.phone}</p>}
                {s.email && <p className="text-xs text-slate-600">Email: {s.email}</p>}
                {s.address && <p className="text-xs text-slate-500 line-clamp-1">ĐC: {s.address}</p>}
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal Add Supplier */}
      <Modal isOpen={isSupplierModalOpen} onClose={() => setIsSupplierModalOpen(false)} title="Thêm Nhà Cung Cấp Mới">
        <form onSubmit={handleCreateSupplier} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Tên công ty / NCC (*)</label>
            <Input
              required
              placeholder="VD: Công ty TNHH Đồ Uống Tân Hiệp Phát..."
              value={supplierForm.name}
              onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Người liên hệ</label>
              <Input
                placeholder="Nguyễn Văn A"
                value={supplierForm.contactName}
                onChange={(e) => setSupplierForm({ ...supplierForm, contactName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Số điện thoại</label>
              <Input
                placeholder="090XXXXXXX"
                value={supplierForm.phone}
                onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Email</label>
            <Input
              type="email"
              placeholder="ncc@domain.com"
              value={supplierForm.email}
              onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Địa chỉ</label>
            <Input
              placeholder="Số 123 Đường ABC, Quận XYZ..."
              value={supplierForm.address}
              onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setIsSupplierModalOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" className="bg-[#02712a] text-white">
              Tạo nhà cung cấp
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Create / Edit Purchase Order */}
      <Modal
        isOpen={isPOModalOpen}
        onClose={() => setIsPOModalOpen(false)}
        title={editingPoId ? "Sửa Đơn Nhập Hàng (Nháp)" : isPartner ? "Tạo Đơn Nhập Hàng" : "Đề Xuất Nhập Hàng"}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSavePO} className="space-y-4 pt-2">
          {isPartner ? (
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Cụm sân nhập hàng (*)</label>
              <select
                className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-semibold focus:border-green-600 focus:outline-none disabled:bg-slate-100"
                value={poCourtId}
                // An order restocks one court for its whole life; only its lines change while drafting.
                disabled={Boolean(editingPoId)}
                onChange={(e) => handleChangePoCourt(e.target.value)}
              >
                <option value="">-- Chọn cụm sân --</option>
                {courts.map((court) => (
                  <option key={court.id} value={court.id}>
                    {court.name}
                  </option>
                ))}
              </select>
            </div>
          ) : ownCourtName ? (
            <p className="rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-[#02712a]">
              Đề xuất cho cụm sân <b>{ownCourtName}</b>. Đối tác sẽ duyệt và đặt hàng; bạn xác nhận số thực nhận khi hàng về.
            </p>
          ) : null}

          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Nhà cung cấp</label>
            <select
              className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-semibold focus:border-green-600 focus:outline-none"
              value={poSupplierId}
              onChange={(e) => setPoSupplierId(e.target.value)}
            >
              <option value="">-- Nhập lẻ / Không chọn NCC --</option>
              {suppliers.map((sup) => (
                <option key={sup.id} value={sup.id}>
                  {sup.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase text-slate-700">Danh sách sản phẩm nhập (*)</label>
              <Button type="button" size="sm" variant="secondary" onClick={handleAddPOItem} disabled={servicesForCourt.length === 0}>
                + Thêm dòng
              </Button>
            </div>

            {isPartner && !poCourtId ? (
              <p className="rounded-xl border border-dashed border-slate-300 p-3 text-center text-xs text-slate-500">
                Chọn cụm sân trước để thấy sản phẩm của cụm đó.
              </p>
            ) : null}

            {poItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 border border-slate-200">
                {/* min-w-0: a <select> otherwise refuses to shrink below its longest product name and pushes the price off-screen. */}
                <select
                  className="min-w-0 flex-1 truncate rounded-lg border border-slate-300 p-2 text-xs font-bold"
                  value={item.serviceId}
                  onChange={(e) => handleUpdatePOItem(idx, "serviceId", e.target.value)}
                >
                  {servicesForCourt.map((svc) => (
                    <option key={svc.id} value={svc.id}>
                      {svc.name} ({svc.unit})
                    </option>
                  ))}
                </select>

                <Input
                  type="number"
                  min={1}
                  step={1}
                  required
                  className="w-20 p-2 text-xs"
                  placeholder="SL"
                  value={item.quantity}
                  onChange={(e) => handleUpdatePOItem(idx, "quantity", Number(e.target.value))}
                />

                <Input
                  type="number"
                  min={0}
                  required
                  className="w-28 p-2 text-xs"
                  placeholder="Giá nhập"
                  value={item.unitCost}
                  onChange={(e) => handleUpdatePOItem(idx, "unitCost", Number(e.target.value))}
                />

                <button
                  type="button"
                  onClick={() => handleRemovePOItem(idx)}
                  className="shrink-0 p-1 text-slate-400 hover:text-rose-600"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-xl bg-green-50 p-3 text-sm font-bold text-[#02712a]">
            <span>Tổng tiền đơn nhập:</span>
            <span className="text-lg">{formatMoney(calculatePOTotal())}</span>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Ghi chú đơn nhập</label>
            <textarea
              rows={2}
              className="w-full rounded-xl border border-slate-300 p-2 text-sm"
              placeholder={isPartner ? "VD: Đã thanh toán chuyển khoản..." : "VD: Nước suối sắp hết, cuối tuần có giải..."}
              value={poNote}
              onChange={(e) => setPoNote(e.target.value)}
            />
          </div>

          {isPartner ? (
            <p className="text-xs font-medium text-slate-500">
              Tồn kho chỉ được cộng khi đơn ở trạng thái <b>Đã nhận</b>. Chọn <b>Nhập kho ngay</b> nếu hàng đã có sẵn tại sân.
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setIsPOModalOpen(false)}>
              Đóng
            </Button>
            {editingPoId ? (
              <Button type="submit" name="status" value="DRAFT" className="bg-[#02712a] text-white" disabled={savingPO}>
                Lưu thay đổi
              </Button>
            ) : isPartner ? (
              <>
                <Button type="submit" name="status" value="DRAFT" variant="secondary" disabled={savingPO}>
                  Lưu nháp
                </Button>
                <Button type="submit" name="status" value="ORDERED" variant="secondary" disabled={savingPO}>
                  <Send className="h-4 w-4" /> Đặt hàng
                </Button>
                <Button type="submit" name="status" value="COMPLETED" className="bg-[#02712a] text-white" disabled={savingPO}>
                  <PackageCheck className="h-4 w-4" /> Nhập kho ngay
                </Button>
              </>
            ) : (
              <Button type="submit" name="status" value="DRAFT" className="bg-[#02712a] text-white" disabled={savingPO}>
                <Send className="h-4 w-4" /> Gửi đề xuất
              </Button>
            )}
          </div>
        </form>
      </Modal>

      {/* Modal Receive: count what actually arrived */}
      <Modal
        isOpen={Boolean(receiveTarget)}
        onClose={() => setReceiveTarget(null)}
        title={`Nhận Hàng - ${receiveTarget?.orderCode ?? ""}`}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleReceive} className="space-y-4 pt-2">
          <p className="text-xs font-medium text-slate-600">
            Kiểm đếm hàng tại {receiveTarget?.court?.name ?? "cụm sân"} và nhập số lượng <b>thực nhận</b> từng dòng. Tồn kho sẽ cộng theo số thực nhận;
            phần thiếu không được cộng.
          </p>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase font-extrabold text-slate-600">
                <tr>
                  <th className="p-3">Sản phẩm</th>
                  <th className="p-3 text-right">Đặt</th>
                  <th className="p-3 text-right">Thực nhận</th>
                  <th className="p-3 text-right">Chênh lệch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold">
                {receiveLines.map((item) => {
                  const ordered = Number(item.quantity);
                  const received = Number(receivedCounts[item.id] ?? 0);
                  return (
                    <tr key={item.id}>
                      <td className="p-3">
                        {item.service?.name} <span className="text-xs text-slate-500">({item.service?.unit})</span>
                      </td>
                      <td className="p-3 text-right">{ordered}</td>
                      <td className="p-3 text-right">
                        <Input
                          type="number"
                          min={0}
                          max={ordered}
                          step={1}
                          required
                          className="ml-auto w-24 p-2 text-right text-xs"
                          value={receivedCounts[item.id] ?? 0}
                          onChange={(e) => setReceivedCounts({ ...receivedCounts, [item.id]: Number(e.target.value) })}
                        />
                      </td>
                      <td className={`p-3 text-right ${received < ordered ? "text-amber-700" : "text-slate-400"}`}>
                        {received < ordered ? `-${ordered - received}` : "0"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {shortLines > 0 ? (
            <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">
              {shortLines} dòng hàng nhận thiếu so với đơn. Hãy ghi rõ lý do (giao thiếu, hỏng, giao bù sau...).
            </p>
          ) : null}

          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Ghi chú nhận hàng</label>
            <textarea
              rows={2}
              className="w-full rounded-xl border border-slate-300 p-2 text-sm"
              placeholder="VD: Thiếu 3 chai, NCC hẹn giao bù thứ Hai"
              value={receiveNote}
              onChange={(e) => setReceiveNote(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl bg-green-50 p-3 text-sm font-bold text-[#02712a]">
            <span>Giá trị thực nhận:</span>
            <span className="text-lg">{formatMoney(receivedTotal)}</span>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setReceiveTarget(null)}>
              Đóng
            </Button>
            <Button type="submit" className="bg-[#02712a] text-white" disabled={savingReceipt}>
              <PackageCheck className="h-4 w-4" /> Xác nhận nhận hàng
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Detail: lines and audit trail */}
      <Modal
        isOpen={Boolean(detailTarget)}
        onClose={() => setDetailTarget(null)}
        title={`Chi Tiết Đơn Nhập - ${detailTarget?.orderCode ?? ""}`}
        maxWidth="max-w-2xl"
      >
        {detailTarget ? (
          <div className="space-y-4 pt-2 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <p>
                <span className="text-xs font-bold uppercase text-slate-500">Cụm sân</span>
                <br />
                <b>{detailTarget.court?.name ?? "—"}</b>
                {detailTarget.court?.address ? <span className="block text-xs text-slate-500">{detailTarget.court.address}</span> : null}
              </p>
              <p>
                <span className="text-xs font-bold uppercase text-slate-500">Nhà cung cấp</span>
                <br />
                <b>{detailTarget.supplier?.name ?? "Nhập lẻ / Tự do"}</b>
              </p>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase font-extrabold text-slate-600">
                  <tr>
                    <th className="p-3">Sản phẩm</th>
                    <th className="p-3 text-right">Đặt</th>
                    <th className="p-3 text-right">Thực nhận</th>
                    <th className="p-3 text-right">Đơn giá</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold">
                  {detailTarget.items.map((item) => {
                    const short = item.receivedQuantity != null && Number(item.receivedQuantity) < Number(item.quantity);
                    return (
                      <tr key={item.id}>
                        <td className="p-3">
                          {item.service?.name} <span className="text-xs text-slate-500">({item.service?.unit})</span>
                        </td>
                        <td className="p-3 text-right">{Number(item.quantity)}</td>
                        <td className={`p-3 text-right ${short ? "text-amber-700" : ""}`}>
                          {item.receivedQuantity == null ? "—" : Number(item.receivedQuantity)}
                        </td>
                        <td className="p-3 text-right">{formatMoney(item.unitCost)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap justify-between gap-2 rounded-xl bg-slate-50 p-3 font-bold">
              <span>Tổng đặt: {formatMoney(detailTarget.totalAmount)}</span>
              {detailTarget.receivedAmount != null ? <span className="text-[#02712a]">Thực nhận: {formatMoney(detailTarget.receivedAmount)}</span> : null}
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase text-slate-500">Nhật ký đơn</p>
              <ul className="space-y-1.5 text-xs text-slate-700">
                <AuditLine label="Tạo / đề xuất" person={detailTarget.createdBy} at={detailTarget.createdAt} />
                <AuditLine label="Duyệt & đặt hàng" person={detailTarget.orderedBy} at={detailTarget.orderedAt} />
                <AuditLine label="Nhận hàng" person={detailTarget.receivedBy} at={detailTarget.receivedAt} />
                <AuditLine label="Hủy" person={detailTarget.cancelledBy} at={detailTarget.cancelledAt} />
              </ul>
            </div>

            {detailTarget.note ? <p className="text-xs text-slate-600">Ghi chú đơn: {detailTarget.note}</p> : null}
            {detailTarget.receiveNote ? (
              <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">Ghi chú nhận hàng: {detailTarget.receiveNote}</p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function AuditLine({ label, person, at }: { label: string; person?: PurchaseOrderPerson | null; at?: string | null }) {
  if (!at) return null;
  return (
    <li className="flex flex-wrap gap-x-2">
      <span className="w-32 font-bold text-slate-500">{label}</span>
      <span>
        {person?.fullName ?? "—"} · {formatTime(at)}
      </span>
    </li>
  );
}
