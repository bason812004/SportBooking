import { useEffect, useState } from "react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Clock,
  User,
  RefreshCw,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { cashierApi, type CashierBooking, type ActiveBookingService } from "../../features/cashier/api/cashierApi";
import { serviceApi, type ServiceCategory, type ServiceItem } from "../../features/services/api/serviceApi";
import { getSocket } from "../../lib/socket";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { formatMoney } from "../../utils/formatters";

export function PartnerCashierPage() {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [activeBookings, setActiveBookings] = useState<CashierBooking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<CashierBooking | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [searchService, setSearchService] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  // Toast feedback state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Locked Invoices persistent map
  const [lockedInvoices, setLockedInvoices] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("cashier_locked_invoices");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const isCurrentBookingLocked = Boolean(selectedBooking && lockedInvoices[selectedBooking.id]);

  const toggleLockInvoice = (bookingId: string, lockState: boolean) => {
    setLockedInvoices((prev) => {
      const updated = { ...prev, [bookingId]: lockState };
      try {
        localStorage.setItem("cashier_locked_invoices", JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save locked invoices:", e);
      }
      return updated;
    });

    if (lockState) {
      showToast("Hóa đơn đã được lưu và khóa chỉnh sửa!", "success");
    } else {
      showToast("Đã mở khóa hóa đơn. Bạn có thể chỉnh sửa lại!", "info");
    }
  };

  // Rental Return Modal
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedRental, setSelectedRental] = useState<{ id: string; name: string } | null>(null);
  const [returnStatus, setReturnStatus] = useState<"RETURNED" | "DAMAGED" | "LOST">("RETURNED");
  const [returnNotes, setReturnNotes] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bookings, cats] = await Promise.all([
        cashierApi.getActiveBookings(),
        serviceApi.getCategories()
      ]);
      setActiveBookings(bookings);
      if (bookings.length > 0 && !selectedBooking) {
        setSelectedBooking(bookings[0]);
      } else if (selectedBooking) {
        const updated = bookings.find((b) => b.id === selectedBooking.id);
        if (updated) setSelectedBooking(updated);
      }
      setCategories(cats);
    } catch (err) {
      console.error("Failed to load cashier data:", err);
      showToast("Lỗi tải dữ liệu thu ngân", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch available services when selected booking changes
  useEffect(() => {
    if (!selectedBooking) return;
    const fetchServices = async () => {
      try {
        const svcs = await serviceApi.getCourtServices(selectedBooking.court.id, selectedCategory);
        setServices(svcs);
      } catch (err) {
        console.error("Failed to load court services:", err);
      }
    };
    fetchServices();
  }, [selectedBooking, selectedCategory]);

  // Realtime Socket IO listeners
  useEffect(() => {
    if (!selectedBooking) return;

    const socket = getSocket(token || "");
    socket.emit("booking:subscribe", selectedBooking.id);

    const handleServiceAdded = () => fetchData();
    const handleServiceUpdated = () => fetchData();
    const handleServiceRemoved = () => fetchData();
    const handleTotalUpdated = () => fetchData();

    socket.on("booking:service-added", handleServiceAdded);
    socket.on("booking:service-updated", handleServiceUpdated);
    socket.on("booking:service-removed", handleServiceRemoved);
    socket.on("booking:total-updated", handleTotalUpdated);

    return () => {
      socket.emit("booking:unsubscribe", selectedBooking.id);
      socket.off("booking:service-added", handleServiceAdded);
      socket.off("booking:service-updated", handleServiceUpdated);
      socket.off("booking:service-removed", handleServiceRemoved);
      socket.off("booking:total-updated", handleTotalUpdated);
    };
  }, [token, selectedBooking?.id]);

  const [isAdding, setIsAdding] = useState(false);

  const handleAddService = async (service: ServiceItem) => {
    if (!selectedBooking || isAdding) return;

    if (isCurrentBookingLocked) {
      showToast("Hóa đơn đã được lưu và khóa. Vui lòng mở khóa để thêm dịch vụ!", "error");
      return;
    }

    setIsAdding(true);

    // Optimistic UI update
    const prevBooking = { ...selectedBooking };
    const existingIndex = selectedBooking.services?.findIndex((s) => s.serviceId === service.id || s.service?.id === service.id);
    let updatedServices = [...(selectedBooking.services || [])];

    if (existingIndex !== undefined && existingIndex >= 0) {
      const existing = updatedServices[existingIndex];
      updatedServices[existingIndex] = {
        ...existing,
        quantity: existing.quantity + 1,
        totalPrice: Number(existing.unitPrice || service.price) * (existing.quantity + 1)
      };
    } else {
      updatedServices.push({
        id: `temp_${Date.now()}`,
        bookingId: selectedBooking.id,
        serviceId: service.id,
        quantity: 1,
        price: Number(service.price),
        unitPrice: Number(service.price),
        totalPrice: Number(service.price),
        status: "ACTIVE",
        addedBy: "CASHIER",
        service: {
          id: service.id,
          name: service.name,
          type: service.type as any,
          unit: service.unit
        }
      });
    }

    const newServiceSubtotal = updatedServices.reduce((sum, item) => sum + Number(item.totalPrice || item.price || 0), 0);
    const newTotal = selectedBooking.courtSubtotal + newServiceSubtotal;
    const newRemaining = Math.max(0, newTotal - selectedBooking.depositPaid);

    setSelectedBooking({
      ...selectedBooking,
      services: updatedServices,
      serviceSubtotal: newServiceSubtotal,
      totalAmount: newTotal,
      remainingAmount: newRemaining
    });

    try {
      await cashierApi.addServiceToBooking(selectedBooking.id, service.id, 1);
      showToast(`Đã thêm "+1 ${service.name}"`, "success");
      fetchData();
    } catch (err: any) {
      setSelectedBooking(prevBooking);
      showToast(err.message || err.response?.data?.message || "Lỗi thêm dịch vụ", "error");
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateQuantity = async (serviceId: string, currentQty: number, delta: number) => {
    if (!selectedBooking) return;

    if (isCurrentBookingLocked) {
      showToast("Hóa đơn đã được lưu và khóa. Vui lòng mở khóa để chỉnh sửa!", "error");
      return;
    }

    const newQty = currentQty + delta;
    try {
      if (newQty <= 0) {
        await cashierApi.removeServiceFromBooking(selectedBooking.id, serviceId);
        showToast("Đã xóa dịch vụ khỏi hóa đơn", "info");
      } else {
        await cashierApi.updateServiceQuantity(selectedBooking.id, serviceId, newQty);
      }
      fetchData();
    } catch (err: any) {
      showToast(err.message || err.response?.data?.message || "Lỗi cập nhật số lượng", "error");
    }
  };

  const handleRemoveService = async (serviceId: string) => {
    if (!selectedBooking) return;

    if (isCurrentBookingLocked) {
      showToast("Hóa đơn đã được lưu và khóa. Vui lòng mở khóa để xóa!", "error");
      return;
    }

    try {
      await cashierApi.removeServiceFromBooking(selectedBooking.id, serviceId);
      showToast("Đã xóa dịch vụ thành công", "info");
      fetchData();
    } catch (err: any) {
      showToast(err.message || err.response?.data?.message || "Lỗi xóa dịch vụ", "error");
    }
  };

  const handleReturnRental = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRental) return;
    try {
      await cashierApi.returnRentalItem(selectedRental.id, returnStatus, returnNotes);
      setIsReturnModalOpen(false);
      showToast("Đã xử lý trả thiết bị cho thuê thành công!", "success");
      fetchData();
    } catch (err: any) {
      showToast(err.message || err.response?.data?.message || "Lỗi trả thiết bị cho thuê", "error");
    }
  };

  const filteredServices = services.filter((svc) =>
    svc.name.toLowerCase().includes(searchService.toLowerCase())
  );

  return (
    <div className="space-y-6 relative">
      {/* Toast Notification Banner */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl text-sm font-extrabold text-white transition-all duration-300 transform translate-y-0 ${
            toast.type === "success"
              ? "bg-[#02712a]"
              : toast.type === "error"
              ? "bg-rose-600"
              : "bg-slate-800"
          }`}
        >
          {toast.type === "success" && <CheckCircle2 className="h-5 w-5" />}
          {toast.type === "error" && <AlertCircle className="h-5 w-5" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Màn Hình Thu Ngân & Bán Dịch Vụ (POS)</h1>
          <p className="text-sm font-medium text-slate-600">
            Ghi nhận dịch vụ khách dùng tại sân realtime, quản lý đồ ăn/uống và tiến hành checkout.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button className="flex items-center gap-2 bg-[#02712a] text-white font-bold" onClick={fetchData}>
            <RefreshCw className="h-4 w-4" /> Cập nhật sân đang hoạt động
          </Button>
        </div>
      </div>

      {/* Main Grid: Active Courts List + Services Menu + Cart & Checkout */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Active Courts Selector */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-600">
              Sân Đang Hoạt Động ({activeBookings.length})
            </h2>
          </div>

          {loading ? (
            <div className="h-40 rounded-2xl bg-slate-100 animate-pulse" />
          ) : activeBookings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">
              Không có sân nào đang được sử dụng hoặc hoạt động hôm nay.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
              {activeBookings.map((b) => {
                const isSelected = selectedBooking?.id === b.id;
                const isLocked = Boolean(lockedInvoices[b.id]);

                return (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBooking(b)}
                    className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 ${
                      isSelected
                        ? "border-[#02712a] bg-green-50/90 shadow-md ring-2 ring-green-600/20"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                        {b.court.name}
                        {isLocked && (
                          <span className="inline-flex items-center gap-0.5 rounded-md bg-green-100 px-1.5 py-0.5 text-[9px] font-black text-[#02712a]">
                            <Lock className="h-2.5 w-2.5" /> Đã lưu
                          </span>
                        )}
                      </span>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800 uppercase">
                        {b.bookingStatus}
                      </span>
                    </div>

                    <div className="mt-2 space-y-1 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        <span>{b.user.fullName}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>
                          {b.startTime.slice(0, 5)} - {b.endTime.slice(0, 5)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                      <span className="text-slate-500 font-medium">Tạm tính:</span>
                      <span className="font-black text-[#02712a] text-sm">{formatMoney(b.totalAmount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Middle Column: Available Services for Court */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <span>Menu Dịch Vụ</span>
                {selectedBooking && (
                  <span className="text-[#02712a] bg-green-50 px-2 py-0.5 rounded-lg border border-green-200">
                    {selectedBooking.court.name}
                  </span>
                )}
              </h2>
            </div>

            {/* Search & Category Filter */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Tìm món / dụng cụ..."
                value={searchService}
                onChange={(e) => setSearchService(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedCategory("")}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                  selectedCategory === "" ? "bg-[#02712a] text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Tất cả
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                    selectedCategory === cat.id
                      ? "bg-[#02712a] text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Service Cards Grid */}
          <div className="grid gap-3 sm:grid-cols-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
            {filteredServices.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-500">
                Không có dịch vụ phù hợp với môn thể thao của sân này
              </div>
            ) : (
              filteredServices.map((svc) => {
                const isLocked = isCurrentBookingLocked;

                return (
                  <div
                    key={svc.id}
                    onClick={() => handleAddService(svc)}
                    className={`group relative rounded-2xl border p-4 shadow-sm transition-all duration-200 flex flex-col justify-between select-none ${
                      isLocked
                        ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-75"
                        : "cursor-pointer border-slate-200 bg-white hover:border-green-500 hover:shadow-md active:scale-95"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          {svc.type === "RENTAL_SERVICE" ? "Cho thuê" : svc.unit}
                        </span>
                        {svc.type === "PRODUCT" && (
                          <span className="text-[10px] font-bold text-slate-600">
                            Kho: {svc.inventory?.quantity ?? 50}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 font-black text-slate-900 text-sm group-hover:text-[#02712a] transition">
                        {svc.name}
                      </h3>
                    </div>

                    <div className="mt-4 flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="font-black text-[#02712a] text-base">{formatMoney(svc.price)}</span>
                      <button
                        disabled={isLocked}
                        className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${
                          isLocked
                            ? "bg-slate-200 text-slate-400"
                            : "bg-green-50 text-[#02712a] group-hover:bg-[#02712a] group-hover:text-white"
                        }`}
                      >
                        {isLocked ? <Lock className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Selected Booking Cart & Checkout */}
        <div className="lg:col-span-4 space-y-4">
          {selectedBooking ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl flex flex-col justify-between min-h-[calc(100vh-220px)]">
              <div>
                {/* Header info */}
                <div className="border-b border-slate-100 pb-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <h2 className="font-black text-slate-900 text-lg flex items-center gap-2">
                      {selectedBooking.court.name}
                    </h2>
                    <span className="text-xs font-black text-[#02712a] bg-green-50 px-2.5 py-1 rounded-lg border border-green-200">
                      #{selectedBooking.bookingCode}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Khách hàng: <strong className="text-slate-900">{selectedBooking.user.fullName}</strong> ({selectedBooking.user.phone || selectedBooking.user.email})
                  </p>
                  <p className="text-xs text-slate-500">
                    Khung giờ chơi: {selectedBooking.startTime.slice(0, 5)} - {selectedBooking.endTime.slice(0, 5)}
                  </p>
                </div>

                {/* Locked Invoice Status Banner */}
                {isCurrentBookingLocked ? (
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900">
                    <div className="flex items-center gap-2 font-extrabold">
                      <Lock className="h-4 w-4 text-[#02712a]" />
                      <span>HÓA ĐƠN ĐÃ LƯU & KHÓA CHỈNH SỬA</span>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm("Bạn có chắc chắn muốn mở khóa hóa đơn để chỉnh sửa lại dịch vụ?")) {
                          toggleLockInvoice(selectedBooking.id, false);
                        }
                      }}
                      className="flex items-center gap-1 font-bold text-slate-600 hover:text-slate-900 hover:underline"
                    >
                      <Unlock className="h-3.5 w-3.5" /> Mở khóa
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800">
                    <span className="font-medium">Chế độ đang chỉnh sửa (Chưa khóa hóa đơn)</span>
                    <button
                      onClick={() => toggleLockInvoice(selectedBooking.id, true)}
                      className="flex items-center gap-1.5 rounded-lg bg-[#02712a] px-3 py-1 font-extrabold text-white shadow-sm hover:bg-[#1fa955] transition"
                    >
                      <Lock className="h-3.5 w-3.5" /> LƯU HÓA ĐƠN
                    </button>
                  </div>
                )}

                {/* Selected Services Item List */}
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase text-slate-600 tracking-wider">
                      Dịch vụ đã chọn ({selectedBooking.services?.length || 0})
                    </h3>
                  </div>

                  {selectedBooking.services?.length === 0 ? (
                    <div className="rounded-xl bg-slate-50 p-6 text-center text-xs text-slate-500 border border-slate-200/60">
                      Chưa thêm dịch vụ nào. Click vào sản phẩm ở menu để thêm mượt mà.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                      {selectedBooking.services.map((item) => (
                        <div key={item.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-200">
                          <div className="flex-1 pr-2">
                            <p className="text-xs font-bold text-slate-900">{item.service?.name || "Dịch vụ"}</p>
                            <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                              {formatMoney(item.unitPrice || item.price)} x {item.quantity} = <strong className="text-[#02712a]">{formatMoney(Number(item.unitPrice || item.price) * item.quantity)}</strong>
                            </p>

                            {/* Rental item status badges */}
                            {item.rentalItems && item.rentalItems.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {item.rentalItems.map((rental) => (
                                  <button
                                    key={rental.id}
                                    onClick={() => {
                                      if (isCurrentBookingLocked) {
                                        showToast("Hóa đơn đã khóa. Vui lòng mở khóa để xử lý trả đồ!", "error");
                                        return;
                                      }
                                      setSelectedRental({ id: rental.id, name: item.service?.name || "Vợt" });
                                      setIsReturnModalOpen(true);
                                    }}
                                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                      rental.status === "RETURNED"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : rental.status === "DAMAGED"
                                        ? "bg-rose-100 text-rose-800"
                                        : "bg-amber-100 text-amber-800 hover:bg-amber-200"
                                    }`}
                                  >
                                    {rental.status === "RENTED" ? "Đang thuê (Click trả)" : rental.status}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Quantity +/- Buttons */}
                          <div className="flex items-center gap-1.5">
                            <button
                              disabled={isCurrentBookingLocked}
                              onClick={() => handleUpdateQuantity(item.serviceId || item.id, item.quantity, -1)}
                              className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${
                                isCurrentBookingLocked
                                  ? "bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed"
                                  : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100 active:scale-95"
                              }`}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="text-xs font-black w-5 text-center text-slate-900">{item.quantity}</span>
                            <button
                              disabled={isCurrentBookingLocked}
                              onClick={() => handleUpdateQuantity(item.serviceId || item.id, item.quantity, 1)}
                              className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${
                                isCurrentBookingLocked
                                  ? "bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed"
                                  : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100 active:scale-95"
                              }`}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                            <button
                              disabled={isCurrentBookingLocked}
                              onClick={() => handleRemoveService(item.serviceId || item.id)}
                              className={`ml-1 transition ${
                                isCurrentBookingLocked
                                  ? "text-slate-300 cursor-not-allowed"
                                  : "text-slate-400 hover:text-rose-600"
                              }`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Totals & Action Buttons */}
              <div className="space-y-3 border-t border-slate-100 pt-4 mt-4">
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Tiền thuê sân:</span>
                    <span className="font-bold text-slate-900">{formatMoney(selectedBooking.courtSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Tiền dịch vụ đã chọn:</span>
                    <span className="font-bold text-slate-900">{formatMoney(selectedBooking.serviceSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Tiền cọc đã trả:</span>
                    <span className="font-bold text-blue-600">-{formatMoney(selectedBooking.depositPaid)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-100">
                    <span>Tổng cần thanh toán:</span>
                    <span className="text-lg font-black text-[#02712a]">{formatMoney(selectedBooking.remainingAmount)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {!isCurrentBookingLocked && (
                    <Button
                      variant="secondary"
                      className="w-full h-10 border-green-600 text-[#02712a] hover:bg-green-50 font-extrabold text-xs"
                      onClick={() => toggleLockInvoice(selectedBooking.id, true)}
                    >
                      <Lock className="mr-1.5 h-4 w-4" /> LƯU & KHÓA HÓA ĐƠN DỊCH VỤ
                    </Button>
                  )}

                  <Button
                    className="w-full h-12 bg-[#02712a] text-white font-extrabold text-base shadow-md hover:bg-[#1fa955] transition"
                    onClick={() => navigate(`/booking/${selectedBooking.id}/checkout`)}
                  >
                    <CreditCard className="mr-2 h-5 w-5" /> CHECKOUT VÀ THANH TOÁN
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
              Vui lòng chọn một sân ở cột bên trái để quản lý thu ngân.
            </div>
          )}
        </div>
      </div>

      {/* Return Rental Modal */}
      <Modal isOpen={isReturnModalOpen} onClose={() => setIsReturnModalOpen(false)} title={`Xử Lý Trả Thiết Bị - ${selectedRental?.name}`}>
        <form onSubmit={handleReturnRental} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Trạng thái hoàn trả (*)</label>
            <select
              className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-semibold focus:border-green-600 focus:outline-none"
              value={returnStatus}
              onChange={(e) => setReturnStatus(e.target.value as any)}
            >
              <option value="RETURNED">Đã trả lại bình thường (Hoàn tồn kho)</option>
              <option value="DAMAGED">Hỏng hóc (Ghi nhận tổn thất)</option>
              <option value="LOST">Làm mất (Ghi nhận thất thoát)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Ghi chú hỏng/mất (nếu có)</label>
            <textarea
              rows={3}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-sm"
              placeholder="VD: Gãy cán vợt, đứt dây..."
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setIsReturnModalOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" className="bg-[#02712a] text-white font-bold">
              Xác nhận trả
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
