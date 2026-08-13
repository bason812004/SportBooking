import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Search,
  Clock,
  User,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Phone,
  LayoutGrid,
  ShieldCheck,
  Tag,
  ChevronRight,
  Receipt,
  Lock,
  Unlock
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { cashierApi, type CashierBookingDetail, type ActiveBookingService } from "../../features/cashier/api/cashierApi";
import { serviceApi, type ServiceCategory, type ServiceItem } from "../../features/services/api/serviceApi";
import { formatMoney } from "../../utils/formatters";

export function CashierBookingPosPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<CashierBookingDetail | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Locked Invoices persistent map (shared key with PartnerCashierPage)
  const [lockedInvoices, setLockedInvoices] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("cashier_locked_invoices");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const isLocked = Boolean(bookingId && lockedInvoices[bookingId]);
  const [unlockConfirmOpen, setUnlockConfirmOpen] = useState(false);

  const toggleLockInvoice = (id: string, lockState: boolean) => {
    setLockedInvoices((prev) => {
      const updated = { ...prev, [id]: lockState };
      try {
        localStorage.setItem("cashier_locked_invoices", JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save locked invoices:", e);
      }
      return updated;
    });
    showToast(lockState ? "Hóa đơn đã được lưu và khóa chỉnh sửa!" : "Đã mở khóa hóa đơn. Bạn có thể chỉnh sửa lại!");
  };

  const fetchDetail = async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const bDetail = await cashierApi.getBookingDetail(bookingId).catch(() => null);
      const cats = await serviceApi.getCategories().catch(() => []);

      setDetail(bDetail);
      setCategories(cats || []);

      if (!bDetail) {
        setServices([]);
        return;
      }

      const courtId = bDetail.booking?.court?.id;
      let svcs: ServiceItem[] = courtId ? await serviceApi.getCourtServices(courtId, selectedCategory).catch(() => []) : [];
      if (!svcs || svcs.length === 0) {
        svcs = await serviceApi.getPartnerServices({ categoryId: selectedCategory }).catch(() => []);
      }
      setServices(svcs || []);
    } catch (err) {
      console.error("Failed to load cashier detail for page:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [bookingId, selectedCategory]);

  const handleAddService = async (service: ServiceItem) => {
    if (!bookingId || submitting) return;
    if (isLocked) {
      showToast("Hóa đơn đã khóa. Vui lòng mở khóa để thêm dịch vụ!");
      return;
    }
    setSubmitting(true);
    try {
      const res = await cashierApi.addServiceToBooking(bookingId, service.id, 1);
      if (res?.totals) {
        setDetail(res.totals);
      } else {
        await fetchDetail();
      }
      showToast(`Đã thêm "${service.name}" vào hóa đơn`);
    } catch (err: any) {
      // Optimistic update fallback
      if (detail) {
        const existingIdx = detail.activeServices.findIndex((s) => s.serviceId === service.id || s.service?.name === service.name);
        let updatedServices = [...detail.activeServices];
        if (existingIdx >= 0) {
          const existing = updatedServices[existingIdx];
          const newQty = existing.quantity + 1;
          const newTotal = newQty * Number(service.price);
          updatedServices[existingIdx] = {
            ...existing,
            quantity: newQty,
            totalPrice: newTotal
          };
        } else {
          updatedServices.push({
            id: "temp_" + Date.now(),
            bookingId,
            serviceId: service.id,
            quantity: 1,
            price: Number(service.price),
            unitPrice: Number(service.price),
            totalPrice: Number(service.price),
            status: "ACTIVE",
            addedBy: "CASHIER",
            service: { id: service.id, name: service.name, type: service.type, unit: service.unit }
          });
        }
        const newServiceSubtotal = updatedServices.reduce((sum, item) => sum + Number(item.totalPrice), 0);
        const newGrandTotal = detail.courtSubtotal + newServiceSubtotal - detail.voucherDiscount;
        setDetail({
          ...detail,
          serviceSubtotal: newServiceSubtotal,
          grandTotal: newGrandTotal,
          remainingAmount: Math.max(0, newGrandTotal - detail.depositPaid),
          activeServices: updatedServices
        });
      }
      showToast(`Đã thêm "${service.name}" vào giỏ hàng`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateQty = async (serviceId: string, quantity: number) => {
    if (!bookingId || submitting) return;
    if (isLocked) {
      showToast("Hóa đơn đã khóa. Vui lòng mở khóa để chỉnh sửa!");
      return;
    }
    setSubmitting(true);
    try {
      if (quantity <= 0) {
        const res = await cashierApi.removeServiceFromBooking(bookingId, serviceId);
        if (res?.totals) setDetail(res.totals);
        else await fetchDetail();
        showToast("Đã xóa dịch vụ khỏi hóa đơn");
      } else {
        const res = await cashierApi.updateServiceQuantity(bookingId, serviceId, quantity);
        if (res?.totals) setDetail(res.totals);
        else await fetchDetail();
      }
    } catch {
      await fetchDetail();
    } finally {
      setSubmitting(false);
    }
  };

  const filteredServices = services.filter((svc) => {
    const matchCat = !selectedCategory || svc.categoryId === selectedCategory;
    const matchSearch = !search || svc.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const formatTimeStr = (val: any) => {
    if (!val) return "22:00";
    const str = String(val);
    if (str.includes("T")) return str.slice(11, 16);
    return str.slice(0, 5);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-2xl bg-[#02712a] px-5 py-3 text-white font-bold shadow-2xl animate-bounce">
          <CheckCircle2 className="h-5 w-5 text-emerald-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition shadow-sm"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
              <ShoppingBag className="h-6 w-6 text-[#02712a]" />
              Bán Dịch Vụ & Thu Ngân (POS)
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Quản lý các mặt hàng ăn uống, dụng cụ thể thao & combo trực tiếp cho sân
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-[#02712a] border border-emerald-200">
            <Sparkles className="h-3.5 w-3.5" /> Hệ Thống POS Trực Tiếp
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex h-96 items-center justify-center rounded-3xl bg-white shadow-sm border border-slate-200">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#02712a] border-t-transparent" />
            <p className="text-sm font-bold text-slate-600">Đang tải dữ liệu dịch vụ & đơn đặt sân...</p>
          </div>
        </div>
      ) : !detail ? (
        <div className="flex h-96 items-center justify-center rounded-3xl bg-white p-8 text-center border border-slate-200">
          <div>
            <p className="text-lg font-bold text-slate-700 mb-3">Không tìm thấy thông tin đơn đặt sân.</p>
            <Button onClick={() => navigate(-1)}>Quay lại danh sách</Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Column (7 Cols) - Product Selection Grid */}
          <div className="lg:col-span-7 space-y-4">
            {/* Booking Summary Hero Banner */}
            <div className="rounded-3xl bg-gradient-to-r from-emerald-900 via-[#02712a] to-emerald-800 p-5 text-white shadow-xl relative overflow-hidden">
              <div className="absolute right-0 top-0 h-40 w-40 translate-x-10 -translate-y-10 rounded-full bg-white/10 blur-2xl pointer-events-none" />
              <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="rounded-lg bg-white/20 px-2.5 py-0.5 text-xs font-black tracking-wider uppercase backdrop-blur">
                      Đơn #{detail.booking.bookingCode}
                    </span>
                    <span className="rounded-lg bg-emerald-400/30 px-2.5 py-0.5 text-xs font-black text-emerald-100 border border-emerald-300/30">
                      {detail.booking.court?.name || "Sân Sala 1 · Sân 01"}
                    </span>
                  </div>
                  <h2 className="text-xl font-black">{detail.booking.user?.fullName || "Khách vãng lai"}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-emerald-100 font-medium">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-emerald-300" />
                      Giờ phục vụ: {formatTimeStr(detail.booking.startTime)} - {formatTimeStr(detail.booking.endTime)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-emerald-300" />
                      {detail.booking.user?.phone || "Chưa cung cấp SĐT"}
                    </span>
                  </div>
                </div>

                <div className="text-right bg-white/10 backdrop-blur rounded-2xl p-3 border border-white/10">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-200">Tiền sân hiện tại</p>
                  <p className="text-xl font-black text-white">{formatMoney(detail.courtSubtotal)}</p>
                </div>
              </div>
            </div>

            {/* Locked Invoice Status Banner */}
            {isLocked ? (
              <div className="flex items-center justify-between rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900">
                <div className="flex items-center gap-2 font-extrabold">
                  <Lock className="h-4 w-4 text-[#02712a]" />
                  <span>HÓA ĐƠN ĐÃ LƯU & KHÓA CHỈNH SỬA</span>
                </div>
                <button
                  type="button"
                  onClick={() => setUnlockConfirmOpen(true)}
                  className="flex items-center gap-1 font-bold text-slate-600 hover:text-slate-900 hover:underline"
                >
                  <Unlock className="h-3.5 w-3.5" /> Mở khóa
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-2xl bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800">
                <span className="font-medium">Chế độ đang chỉnh sửa (Chưa khóa hóa đơn)</span>
                <button
                  type="button"
                  onClick={() => bookingId && toggleLockInvoice(bookingId, true)}
                  className="flex items-center gap-1.5 rounded-lg bg-[#02712a] px-3 py-1 font-extrabold text-white shadow-sm hover:bg-[#1fa955] transition"
                >
                  <Lock className="h-3.5 w-3.5" /> LƯU HÓA ĐƠN
                </button>
              </div>
            )}

            {/* Search & Category Filter Section */}
            <div className="rounded-3xl bg-white p-4 shadow-sm border border-slate-200 space-y-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-10 h-10 text-xs font-semibold rounded-xl border-slate-200"
                  placeholder="Tìm kiếm sản phẩm, nước uống, đồ ăn, dụng cụ thể thao..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Category Pills */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("")}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-black transition ${
                    selectedCategory === ""
                      ? "bg-[#02712a] text-white shadow-md shadow-emerald-700/20"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Tất cả ({services.length})
                </button>
                {categories.map((cat) => {
                  const count = services.filter((s) => s.categoryId === cat.id).length;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`rounded-xl px-3.5 py-1.5 text-xs font-black transition ${
                        selectedCategory === cat.id
                          ? "bg-[#02712a] text-white shadow-md shadow-emerald-700/20"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {cat.name} {count > 0 ? `(${count})` : ""}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Products Grid */}
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 max-h-[520px] overflow-y-auto pr-1">
              {filteredServices.length === 0 ? (
                <div className="col-span-full rounded-3xl bg-white p-12 text-center border border-slate-200">
                  <ShoppingBag className="mx-auto h-12 w-12 text-slate-300 mb-2" />
                  <p className="text-sm font-bold text-slate-600">Không tìm thấy dịch vụ nào phù hợp.</p>
                  <p className="text-xs text-slate-400 mt-1">Thử thay đổi từ khóa tìm kiếm hoặc chọn danh mục khác.</p>
                </div>
              ) : (
                filteredServices.map((svc) => (
                  <div
                    key={svc.id}
                    onClick={() => handleAddService(svc)}
                    className={`group rounded-2xl border p-4 shadow-sm transition flex flex-col justify-between relative overflow-hidden ${
                      isLocked
                        ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-75"
                        : "cursor-pointer border-slate-200 bg-white hover:border-[#02712a] hover:shadow-md"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-[#02712a]">
                          {svc.unit || "Món"}
                        </span>
                        {svc.type === "RENTAL_SERVICE" && (
                          <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700">
                            Cho thuê
                          </span>
                        )}
                      </div>
                      <h3 className="font-extrabold text-slate-900 text-xs line-clamp-2 group-hover:text-[#02712a] transition">
                        {svc.name}
                      </h3>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-2.5">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đơn giá</p>
                        <p className="text-xs font-black text-[#02712a]">{formatMoney(svc.price)}</p>
                      </div>
                      <button
                        type="button"
                        disabled={isLocked}
                        className={`flex h-8 w-8 items-center justify-center rounded-xl transition shadow-sm ${
                          isLocked
                            ? "bg-slate-200 text-slate-400"
                            : "bg-emerald-50 text-[#02712a] group-hover:bg-[#02712a] group-hover:text-white"
                        }`}
                      >
                        {isLocked ? <Lock className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column (5 Cols) - Checkout Order Summary Panel */}
          <div className="lg:col-span-5">
            <div className="sticky top-6 rounded-3xl bg-white border border-slate-200 shadow-xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                    <Receipt className="h-4 w-4 text-[#02712a]" />
                    Hóa Đơn Dịch Vụ Đã Chọn ({detail.activeServices.length})
                  </h3>
                </div>

                {/* Selected Services List */}
                <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
                  {detail.activeServices.length === 0 ? (
                    <div className="rounded-2xl bg-slate-50 p-8 text-center border border-dashed border-slate-200">
                      <ShoppingBag className="mx-auto h-8 w-8 text-slate-300 mb-1" />
                      <p className="text-xs font-bold text-slate-500">Chưa chọn dịch vụ nào</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Nhấp vào món ở cột bên trái để thêm vào hóa đơn</p>
                    </div>
                  ) : (
                    detail.activeServices.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-xs"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="font-extrabold text-slate-900 truncate">
                            {item.service?.name || "Dịch vụ đi kèm"}
                          </p>
                          <p className="text-[11px] font-bold text-[#02712a]">
                            {formatMoney(item.unitPrice || item.price)} / {item.service?.unit || "lần"}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center rounded-xl bg-white border border-slate-200 shadow-sm p-0.5">
                            <button
                              type="button"
                              disabled={isLocked}
                              onClick={() => handleUpdateQty(item.serviceId || item.id, item.quantity - 1)}
                              className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-7 text-center font-black text-slate-900">{item.quantity}</span>
                            <button
                              type="button"
                              disabled={isLocked}
                              onClick={() => handleUpdateQty(item.serviceId || item.id, item.quantity + 1)}
                              className="flex h-6 w-6 items-center justify-center rounded-lg text-[#02712a] hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>

                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() => handleUpdateQty(item.serviceId || item.id, 0)}
                            className="flex h-7 w-7 items-center justify-center rounded-xl text-rose-500 hover:bg-rose-50 transition disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Financial Calculation Summary */}
              <div className="border-t border-slate-100 pt-4 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600 font-semibold">
                  <span>Tiền giờ sân:</span>
                  <span className="font-bold text-slate-900">{formatMoney(detail.courtSubtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 font-semibold">
                  <span>Tiền dịch vụ cộng dồn:</span>
                  <span className="font-bold text-[#02712a]">+{formatMoney(detail.serviceSubtotal)}</span>
                </div>
                {detail.voucherDiscount > 0 && (
                  <div className="flex items-center justify-between text-amber-600 font-semibold">
                    <span>Voucher giảm giá:</span>
                    <span>-{formatMoney(detail.voucherDiscount)}</span>
                  </div>
                )}
                {detail.depositPaid > 0 && (
                  <div className="flex items-center justify-between text-slate-600 font-semibold">
                    <span>Đã đặt cọc trước:</span>
                    <span className="font-bold text-emerald-700">-{formatMoney(detail.depositPaid)}</span>
                  </div>
                )}

                <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">TỔNG CẦN THANH TOÁN</p>
                    <p className="text-xs text-slate-400 font-semibold">(Đã bao gồm tiền sân + dịch vụ)</p>
                  </div>
                  <span className="text-2xl font-black text-[#02712a]">
                    {formatMoney(detail.remainingAmount)}
                  </span>
                </div>

                <Button
                  onClick={() => navigate(`/booking/${bookingId}/checkout`)}
                  className="w-full h-12 bg-[#02712a] text-white hover:bg-[#1fa955] font-black text-sm rounded-2xl shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 mt-3"
                >
                  <CreditCard className="h-5 w-5" />
                  XÁC NHẬN & THANH TOÁN
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unlock Invoice Confirm Modal */}
      <Modal isOpen={unlockConfirmOpen} onClose={() => setUnlockConfirmOpen(false)} title="Mở khóa hóa đơn?" maxWidth="max-w-sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Hóa đơn đang được khóa để tránh chỉnh sửa nhầm. Bạn có chắc chắn muốn mở khóa để tiếp tục thêm/sửa dịch vụ không?
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setUnlockConfirmOpen(false)}>
              Hủy
            </Button>
            <Button
              type="button"
              className="bg-[#02712a] text-white font-bold"
              onClick={() => {
                if (bookingId) toggleLockInvoice(bookingId, false);
                setUnlockConfirmOpen(false);
              }}
            >
              <Unlock className="mr-1.5 h-4 w-4" /> Mở khóa
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
