import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState, useMemo } from "react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Clock,
  User,
  Phone,
  RefreshCw,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Banknote,
  Receipt,
  Printer,
  ChevronRight,
  Filter,
  Check,
  Package,
  Layers,
  MapPin,
  CalendarDays
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { ServiceImage } from "../../components/common/ServiceImage";
import {
  cashierApi,
  type CashierBooking,
  type CashierBookingDetail,
  type ActiveBookingService
} from "../../features/cashier/api/cashierApi";
import { serviceApi, type ServiceCategory, type ServiceItem } from "../../features/services/api/serviceApi";
import { checkoutApi, type CheckoutData } from "../../features/checkout/api/checkoutApi";
import { getSocket } from "../../lib/socket";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { formatMoney } from "../../utils/formatters";

type BookingFilterType = "ALL" | "IN_USE" | "UPCOMING" | "UNPAID" | "PAID" | "COMPLETED";

export function PartnerCashierPage() {
  const { t } = useTranslation("booking");
  const navigate = useNavigate();
  const { token, user } = useAuth();

  // Booking list & selection
  const [activeBookings, setActiveBookings] = useState<CashierBooking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<CashierBooking | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);

  // Filters & Search
  const [searchBooking, setSearchBooking] = useState("");
  const [bookingFilter, setBookingFilter] = useState<BookingFilterType>("ALL");
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

  // Modals state
  const [isUnlockConfirmOpen, setIsUnlockConfirmOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedRental, setSelectedRental] = useState<{ id: string; name: string } | null>(null);
  const [returnStatus, setReturnStatus] = useState<"RETURNED" | "DAMAGED" | "LOST">("RETURNED");
  const [returnNotes, setReturnNotes] = useState("");

  // Checkout Payment Modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK_TRANSFER" | "QR_TRANSFER">("CASH");
  const [cashGiven, setCashGiven] = useState<number>(0);
  const [transactionRef, setTransactionRef] = useState<string>("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Success Receipt Modal state
  const [receiptData, setReceiptData] = useState<{
    booking: CashierBooking;
    paidAmount: number;
    paymentMethod: string;
    paidAt: string;
    transactionId?: string;
  } | null>(null);

  // Fetch active bookings with search & filter
  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [bookings, cats] = await Promise.all([
        cashierApi.getActiveBookings(undefined, searchBooking, bookingFilter),
        serviceApi.getCategories()
      ]);
      setActiveBookings(bookings);
      setSelectedBooking((prev) => {
        if (!prev) return bookings.length > 0 ? bookings[0] : null;
        if (hasAnyPendingWork()) return prev;
        const found = bookings.find((b) => b.id === prev.id);
        return found || (bookings.length > 0 ? bookings[0] : null);
      });
      setCategories(cats);
    } catch (err) {
      console.error("Failed to load cashier data:", err);
      if (!silent) showToast("Lỗi tải dữ liệu thu ngân", "error");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Re-fetch when booking filter or search changes (debounced search)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 250);
    return () => clearTimeout(timer);
  }, [bookingFilter, searchBooking]);

  // Periodic silent polling
  useEffect(() => {
    const interval = setInterval(() => fetchData(true), 25000);
    return () => clearInterval(interval);
  }, [bookingFilter, searchBooking]);

  // Fetch services for selected court
  const refetchServices = async () => {
    if (!selectedBooking) return;
    try {
      const svcs = await serviceApi.getCourtServices(selectedBooking.court.id, selectedCategory);
      setServices(svcs);
    } catch (err) {
      console.error("Failed to load court services:", err);
    }
  };

  useEffect(() => {
    refetchServices();
  }, [selectedBooking?.court.id, selectedCategory]);

  // Inventory badge realtime patch
  const patchServiceInventory = (serviceId: string, delta: number) => {
    setServices((prev) =>
      prev.map((s) => (s.id === serviceId && s.inventory ? { ...s, inventory: { ...s.inventory, quantity: s.inventory.quantity + delta } } : s))
    );
  };

  // Patch local state from server-computed totals
  const lastAppliedAtRef = useRef<number>(0);
  const applyTotals = (bookingId: string, totals: CashierBookingDetail) => {
    const patch = (b: CashierBooking): CashierBooking => ({
      ...b,
      services: totals.activeServices,
      courtSubtotal: totals.courtSubtotal,
      serviceSubtotal: totals.serviceSubtotal,
      totalAmount: totals.grandTotal,
      depositPaid: totals.depositPaid,
      remainingAmount: totals.remainingAmount
    });
    setActiveBookings((prev) => prev.map((b) => (b.id === bookingId ? patch(b) : b)));
    setSelectedBooking((prev) => (prev && prev.id === bookingId ? patch(prev) : prev));
  };

  // Lightweight single-booking resync for realtime events
  const socketRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshBookingLight = (targetBookingId: string) => {
    if (Date.now() - lastAppliedAtRef.current < 500) return;
    if (socketRefreshTimerRef.current) clearTimeout(socketRefreshTimerRef.current);
    socketRefreshTimerRef.current = setTimeout(async () => {
      if (hasAnyPendingWork()) return;
      try {
        const detail = await cashierApi.getBookingDetail(targetBookingId);
        if (detail) applyTotals(targetBookingId, detail);
      } catch (err) {
        console.error("Failed to refresh booking after realtime event:", err);
      }
    }, 200);
  };

  // Realtime Socket IO listeners
  useEffect(() => {
    if (!selectedBooking) return;

    const socket = getSocket(token || "");
    const bookingId = selectedBooking.id;
    socket.emit("booking:subscribe", bookingId);

    const refresh = () => refreshBookingLight(bookingId);
    const handleStatusChanged = (payload: any) => {
      if (payload?.bookingId === bookingId) {
        setSelectedBooking((prev) => (prev ? { ...prev, bookingStatus: payload.status || prev.bookingStatus } : prev));
        setActiveBookings((prev) =>
          prev.map((b) => (b.id === bookingId ? { ...b, bookingStatus: payload.status || b.bookingStatus } : b))
        );
      }
    };

    socket.on("booking:service-added", refresh);
    socket.on("booking:service-updated", refresh);
    socket.on("booking:service-removed", refresh);
    socket.on("booking:total-updated", refresh);
    socket.on("booking:payment-completed", refresh);
    socket.on("booking:status-changed", handleStatusChanged);

    return () => {
      socket.emit("booking:unsubscribe", bookingId);
      socket.off("booking:service-added", refresh);
      socket.off("booking:service-updated", refresh);
      socket.off("booking:service-removed", refresh);
      socket.off("booking:total-updated", refresh);
      socket.off("booking:payment-completed", refresh);
      socket.off("booking:status-changed", handleStatusChanged);
    };
  }, [token, selectedBooking?.id]);

  // Pending delta queue for rapid clicks
  const pendingDeltaRef = useRef<Record<string, number>>({});
  const debounceTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const flushQueueRef = useRef<Record<string, Promise<void>>>({});

  const hasPendingWork = (serviceId: string) => Boolean(pendingDeltaRef.current[serviceId]) || serviceId in pendingQtyTargetRef.current;
  const hasAnyPendingWork = () =>
    Object.values(pendingDeltaRef.current).some((v) => v > 0) || Object.keys(pendingQtyTargetRef.current).length > 0;

  const flushAddService = (bookingId: string, service: ServiceItem) => {
    const qty = pendingDeltaRef.current[service.id];
    if (!qty) return;
    pendingDeltaRef.current[service.id] = 0;

    const prevTask = flushQueueRef.current[service.id] || Promise.resolve();
    flushQueueRef.current[service.id] = prevTask
      .then(() => cashierApi.addServiceToBooking(bookingId, service.id, qty))
      .then((res) => {
        lastAppliedAtRef.current = Date.now();
        if (res?.totals && !hasPendingWork(service.id)) applyTotals(bookingId, res.totals);
      })
      .catch((err: any) => {
        showToast(err.message || "Lỗi thêm dịch vụ", "error");
        fetchData();
        refetchServices();
      });
  };

  const handleAddService = (service: ServiceItem) => {
    if (!selectedBooking) return;

    if (isCurrentBookingLocked) {
      showToast("Hóa đơn đã được lưu và khóa. Vui lòng mở khóa để thêm dịch vụ!", "error");
      return;
    }

    // Check stock
    const availableStock = service.trackInventory ? Number(service.inventory?.quantity ?? 0) : 999;
    const inCartQty = selectedBooking.services?.find((s) => s.serviceId === service.id || s.service?.id === service.id)?.quantity || 0;
    const pendingQty = pendingDeltaRef.current[service.id] || 0;
    const totalDesired = inCartQty + pendingQty + 1;

    if (service.trackInventory && totalDesired > availableStock) {
      showToast(`Sản phẩm "${service.name}" không đủ tồn kho (Còn lại: ${Math.max(0, availableStock - inCartQty)})`, "error");
      return;
    }

    const bookingId = selectedBooking.id;

    // Optimistic cart update
    setSelectedBooking((prev) => {
      if (!prev || prev.id !== bookingId) return prev;
      const servicesList = [...(prev.services || [])];
      const idx = servicesList.findIndex((s) => s.serviceId === service.id || s.service?.id === service.id);
      if (idx >= 0) {
        const existing = servicesList[idx];
        const quantity = existing.quantity + 1;
        servicesList[idx] = { ...existing, quantity, totalPrice: Number(existing.unitPrice || service.price) * quantity };
      } else {
        servicesList.push({
          id: `temp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          bookingId,
          serviceId: service.id,
          name: service.name,
          unit: service.unit,
          imageUrl: service.imageUrl || null,
          quantity: 1,
          price: Number(service.price),
          unitPrice: Number(service.price),
          totalPrice: Number(service.price),
          status: "ACTIVE",
          addedBy: "CASHIER",
          service: { id: service.id, name: service.name, type: service.type as any, unit: service.unit, imageUrl: service.imageUrl || null }
        });
      }
      const serviceSubtotal = servicesList.reduce((sum, item) => sum + Number(item.totalPrice || item.price || 0), 0);
      // Adjust the existing totals by the service delta instead of recomputing from courtSubtotal:
      // the list payload carries no voucherDiscount, so recomputing would silently drop it.
      const totalAmount = prev.totalAmount + serviceSubtotal - prev.serviceSubtotal;
      const remainingAmount = Math.max(0, prev.remainingAmount + serviceSubtotal - prev.serviceSubtotal);
      return { ...prev, services: servicesList, serviceSubtotal, totalAmount, remainingAmount };
    });

    patchServiceInventory(service.id, -1);

    const newPending = (pendingDeltaRef.current[service.id] || 0) + 1;
    pendingDeltaRef.current[service.id] = newPending;
    showToast(`Đã thêm ${newPending > 1 ? `x${newPending} ` : ""}"${service.name}"`, "success");

    if (debounceTimerRef.current[service.id]) clearTimeout(debounceTimerRef.current[service.id]);
    debounceTimerRef.current[service.id] = setTimeout(() => flushAddService(bookingId, service), 400);
  };

  const pendingQtyTargetRef = useRef<Record<string, number>>({});
  const qtyDebounceTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const flushQuantityChange = (bookingId: string, serviceId: string) => {
    if (!(serviceId in pendingQtyTargetRef.current)) return;
    const target = pendingQtyTargetRef.current[serviceId];
    delete pendingQtyTargetRef.current[serviceId];

    const prevTask = flushQueueRef.current[serviceId] || Promise.resolve();
    flushQueueRef.current[serviceId] = prevTask
      .then(() => (target <= 0 ? cashierApi.removeServiceFromBooking(bookingId, serviceId) : cashierApi.updateServiceQuantity(bookingId, serviceId, target)))
      .then((res) => {
        lastAppliedAtRef.current = Date.now();
        if (res?.totals && !hasPendingWork(serviceId)) applyTotals(bookingId, res.totals);
      })
      .catch((err: any) => {
        showToast(err.message || "Lỗi cập nhật dịch vụ", "error");
        fetchData();
        refetchServices();
      });
  };

  const patchCartQuantity = (bookingId: string, serviceId: string, newQty: number) => {
    setSelectedBooking((prev) => {
      if (!prev || prev.id !== bookingId) return prev;
      const servicesList =
        newQty <= 0
          ? (prev.services || []).filter((s) => (s.serviceId || s.id) !== serviceId)
          : (prev.services || []).map((s) =>
              (s.serviceId || s.id) === serviceId ? { ...s, quantity: newQty, totalPrice: Number(s.unitPrice || s.price) * newQty } : s
            );
      const serviceSubtotal = servicesList.reduce((sum, item) => sum + Number(item.totalPrice || item.price || 0), 0);
      // Adjust the existing totals by the service delta instead of recomputing from courtSubtotal:
      // the list payload carries no voucherDiscount, so recomputing would silently drop it.
      const totalAmount = prev.totalAmount + serviceSubtotal - prev.serviceSubtotal;
      const remainingAmount = Math.max(0, prev.remainingAmount + serviceSubtotal - prev.serviceSubtotal);
      return { ...prev, services: servicesList, serviceSubtotal, totalAmount, remainingAmount };
    });
  };

  const handleUpdateQuantity = (serviceId: string, currentQty: number, delta: number) => {
    if (!selectedBooking) return;

    if (isCurrentBookingLocked) {
      showToast("Hóa đơn đã được lưu và khóa. Vui lòng mở khóa để chỉnh sửa!", "error");
      return;
    }

    // Check stock if incrementing
    if (delta > 0) {
      const svc = services.find((s) => s.id === serviceId);
      if (svc && svc.trackInventory) {
        const availableStock = Number(svc.inventory?.quantity ?? 0);
        if (availableStock <= 0) {
          showToast(`Sản phẩm "${svc.name}" đã hết hàng trong kho!`, "error");
          return;
        }
      }
    }

    const bookingId = selectedBooking.id;
    const newQty = Math.max(0, currentQty + delta);

    patchCartQuantity(bookingId, serviceId, newQty);
    patchServiceInventory(serviceId, -delta);

    pendingQtyTargetRef.current[serviceId] = newQty;
    if (qtyDebounceTimerRef.current[serviceId]) clearTimeout(qtyDebounceTimerRef.current[serviceId]);
    qtyDebounceTimerRef.current[serviceId] = setTimeout(() => flushQuantityChange(bookingId, serviceId), 300);
  };

  const handleRemoveService = (serviceId: string) => {
    if (!selectedBooking) return;

    if (isCurrentBookingLocked) {
      showToast("Hóa đơn đã được lưu và khóa. Vui lòng mở khóa để xóa!", "error");
      return;
    }

    const bookingId = selectedBooking.id;
    const removedItem = selectedBooking.services?.find((s) => (s.serviceId || s.id) === serviceId);
    const removedQty = removedItem?.quantity || 0;

    patchCartQuantity(bookingId, serviceId, 0);
    if (removedQty > 0) patchServiceInventory(serviceId, removedQty);
    showToast("Đã xóa dịch vụ khỏi hóa đơn", "info");

    if (qtyDebounceTimerRef.current[serviceId]) clearTimeout(qtyDebounceTimerRef.current[serviceId]);
    pendingQtyTargetRef.current[serviceId] = 0;
    flushQuantityChange(bookingId, serviceId);
  };

  const handleReturnRental = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRental || !selectedBooking) return;
    const bookingId = selectedBooking.id;
    try {
      await cashierApi.returnRentalItem(selectedRental.id, returnStatus, returnNotes);
      setIsReturnModalOpen(false);
      showToast("Đã xử lý trả thiết bị cho thuê thành công!", "success");
      const detail = await cashierApi.getBookingDetail(bookingId).catch(() => null);
      if (detail) {
        lastAppliedAtRef.current = Date.now();
        applyTotals(bookingId, detail);
      }
    } catch (err: any) {
      showToast(err.message || err.response?.data?.message || "Lỗi trả thiết bị cho thuê", "error");
    }
  };

  // Check-in action handler
  const handleCheckIn = async () => {
    if (!selectedBooking) return;
    try {
      await cashierApi.checkInBooking(selectedBooking.id);
      showToast(`Khách đã check-in vào ${selectedBooking.courtSurface?.name || selectedBooking.court.name} thành công!`, "success");
      setSelectedBooking((prev) => (prev ? { ...prev, checkedInAt: new Date().toISOString(), bookingStatus: "IN_PROGRESS" } : prev));
      setActiveBookings((prev) =>
        prev.map((b) => (b.id === selectedBooking.id ? { ...b, checkedInAt: new Date().toISOString(), bookingStatus: "IN_PROGRESS" } : b))
      );
    } catch (err: any) {
      showToast(err.message || "Lỗi check-in", "error");
    }
  };

  // Open Checkout Modal
  const handleOpenCheckoutModal = () => {
    if (!selectedBooking) return;
    setCashGiven(selectedBooking.remainingAmount);
    setTransactionRef("");
    setIsPaymentModalOpen(true);
  };

  // Process In-POS Payment
  const handleProcessPayment = async () => {
    if (!selectedBooking) return;
    setIsProcessingPayment(true);

    try {
      // 1. Fetch or create checkout record
      const checkoutData = await checkoutApi.getCheckoutByBooking(selectedBooking.id);
      const checkoutId = checkoutData.checkout.id;
      const amountToPay = selectedBooking.remainingAmount;

      if (amountToPay <= 0) {
        showToast("Đơn hàng này đã thanh toán đủ 100%!", "info");
        setIsPaymentModalOpen(false);
        return;
      }

      // 2. Process checkout payment
      const paymentMethodCode =
        paymentMethod === "QR_TRANSFER" ? "QR_TRANSFER" : paymentMethod === "BANK_TRANSFER" ? "BANK_TRANSFER" : "CASH";

      const txId =
        paymentMethod === "CASH"
          ? `CASH_${Date.now()}`
          : transactionRef.trim()
          ? transactionRef.trim()
          : `POS_${Date.now()}`;

      await checkoutApi.processPayment({
        checkoutId,
        amount: amountToPay,
        paymentMethod: paymentMethodCode,
        transactionId: txId
      });

      // 3. Update local state
      const updatedBooking: CashierBooking = {
        ...selectedBooking,
        remainingAmount: 0,
        paymentStatus: "PAID",
        bookingStatus: "COMPLETED"
      };

      setSelectedBooking(updatedBooking);
      setActiveBookings((prev) => prev.map((b) => (b.id === selectedBooking.id ? updatedBooking : b)));

      // 4. Save receipt data & show receipt modal
      setReceiptData({
        booking: selectedBooking,
        paidAmount: amountToPay,
        paymentMethod:
          paymentMethod === "CASH" ? "Tiền mặt" : paymentMethod === "BANK_TRANSFER" ? "Chuyển khoản" : "VietQR",
        paidAt: new Date().toLocaleString("vi-VN"),
        transactionId: txId
      });

      setIsPaymentModalOpen(false);
      showToast("Thanh toán thành công! Đơn hàng đã hoàn tất.", "success");
    } catch (err: any) {
      console.error("Payment error:", err);
      showToast(err.response?.data?.message || err.message || "Lỗi xử lý thanh toán", "error");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const filteredServices = useMemo(() => {
    return services.filter((svc) => {
      const matchesSearch = svc.name.toLowerCase().includes(searchService.toLowerCase());
      const matchesCat = !selectedCategory || svc.categoryId === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [services, searchService, selectedCategory]);

  return (
    <div className="space-y-5 relative">
      {/* Toast Notification Banner */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl text-sm font-extrabold text-white transition-all duration-300 transform translate-y-0 ${
            toast.type === "success" ? "bg-[#02712a]" : toast.type === "error" ? "bg-rose-600" : "bg-slate-800"
          }`}
        >
          {toast.type === "success" && <CheckCircle2 className="h-5 w-5" />}
          {toast.type === "error" && <AlertCircle className="h-5 w-5" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span className="p-2 rounded-xl bg-green-100 text-[#02712a]">
              <Receipt className="h-5 w-5" />
            </span>
            Quản Lý Khách Đang Sử Dụng Sân & Thu Ngân (POS)
          </h1>
          <p className="text-xs font-medium text-slate-600 mt-1">
            Theo dõi khách tại từng sân con cụ thể, thêm đồ ăn/nước uống/vợt, tính bill realtime và thanh toán tiền mặt/chuyển khoản/VietQR.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="flex items-center gap-2 text-xs font-bold border-slate-300 hover:bg-slate-50"
            onClick={() => fetchData()}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Đồng bộ dữ liệu
          </Button>
        </div>
      </div>

      {/* Main Grid: 3 Columns POS Architecture */}
      <div className="grid gap-5 lg:grid-cols-12 items-start">
        {/* =========================================================================
            LEFT COLUMN: Danh Sách Khách & Sân Đang Hoạt Động (Filter & Search)
           ========================================================================= */}
        <div className="lg:col-span-4 space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-[#02712a]" /> Khách & Sân ({activeBookings.length})
              </h2>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Tìm mã đơn, tên khách, SĐT, sân..."
                value={searchBooking}
                onChange={(e) => setSearchBooking(e.target.value)}
                className="pl-8 text-xs py-2 h-9 rounded-xl"
              />
            </div>

            {/* Status Filter Chips */}
            <div className="flex flex-wrap gap-1">
              {[
                { key: "ALL", label: "Tất cả" },
                { key: "IN_USE", label: "Đang sử dụng" },
                { key: "UPCOMING", label: "Sắp tới" },
                { key: "UNPAID", label: "Chưa trả" },
                { key: "PAID", label: "Đã trả" },
                { key: "COMPLETED", label: "Hoàn tất" }
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setBookingFilter(f.key as BookingFilterType)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition ${
                    bookingFilter === f.key
                      ? "bg-[#02712a] text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bookings List Cards */}
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : activeBookings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-500">
              Không tìm thấy đơn đặt sân nào phù hợp với bộ lọc.
            </div>
          ) : (
            <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
              {activeBookings.map((b) => {
                const isSelected = selectedBooking?.id === b.id;
                const isLocked = Boolean(lockedInvoices[b.id]);
                const isPaid = b.paymentStatus === "PAID" || b.remainingAmount === 0;

                return (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBooking(b)}
                    className={`cursor-pointer rounded-2xl border p-3.5 transition-all duration-200 ${
                      isSelected
                        ? "border-[#02712a] bg-green-50/80 shadow-md ring-2 ring-green-600/30"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                    }`}
                  >
                    {/* Header: Sân con cụ thể & Mã đơn */}
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-slate-900 text-xs">
                          {b.court.name}
                        </span>
                        {b.courtSurface && (
                          <span className="rounded-md bg-purple-100 text-purple-900 border border-purple-200 px-1.5 py-0.2 text-[10px] font-black">
                            {b.courtSurface.name}
                          </span>
                        )}
                        {isLocked && (
                          <span className="inline-flex items-center gap-0.5 rounded-md bg-green-100 px-1.5 py-0.5 text-[9px] font-black text-[#02712a]">
                            <Lock className="h-2.5 w-2.5" /> Khóa
                          </span>
                        )}
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800 uppercase">
                          {!b.checkedInAt ? t("openTab.notCheckedIn") : b.bookingStatus}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-slate-500">
                        #{b.bookingCode.slice(-6)}
                      </span>
                    </div>

                    {/* Customer info */}
                    <div className="mt-2 space-y-1 text-xs text-slate-600">
                      <div className="flex items-center justify-between font-bold text-slate-800">
                        <span className="flex items-center gap-1 truncate">
                          <User className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="truncate">{b.user.fullName}</span>
                        </span>
                        {b.user.phone && (
                          <span className="text-[11px] text-slate-500 font-mono flex items-center gap-0.5">
                            <Phone className="h-2.5 w-2.5" /> {b.user.phone}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-slate-500 text-[11px]">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {b.startTime.slice(0, 5)} - {b.endTime.slice(0, 5)}
                        </span>
                        <span>{b.services?.length || 0} dịch vụ</span>
                      </div>
                    </div>

                    {/* Badges & Remaining */}
                    <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                      <div className="flex items-center gap-1">
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase ${
                            b.bookingStatus === "IN_PROGRESS"
                              ? "bg-emerald-100 text-emerald-800"
                              : b.bookingStatus === "COMPLETED"
                              ? "bg-slate-200 text-slate-700"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {b.bookingStatus === "IN_PROGRESS"
                            ? "Đang dùng"
                            : b.bookingStatus === "COMPLETED"
                            ? "Hoàn tất"
                            : "Sắp tới"}
                        </span>
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase ${
                            isPaid
                              ? "bg-emerald-100 text-emerald-800"
                              : b.depositAmount > 0
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {isPaid ? "Đã trả đủ" : b.depositAmount > 0 ? "Đã cọc" : "Chưa trả"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 mr-1">Thu:</span>
                        <span
                          className={`font-black text-xs ${
                            b.remainingAmount > 0 ? "text-[#02712a]" : "text-slate-500"
                          }`}
                        >
                          {formatMoney(b.remainingAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* =========================================================================
            MIDDLE COLUMN: Menu Dịch Vụ / Đồ Ăn / Thức Uống (Hiển Thị Kho & Trạng Thái)
           ========================================================================= */}
        <div className="lg:col-span-4 space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="h-4 w-4 text-[#02712a]" /> Menu Dịch Vụ
                {selectedBooking && (
                  <span className="text-[11px] font-bold text-[#02712a] bg-green-50 px-2 py-0.5 rounded-lg border border-green-200">
                    {selectedBooking.courtSurface?.name || selectedBooking.court.name}
                  </span>
                )}
              </h2>
            </div>

            {/* Search menu */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Tìm món, nước, đồ thuê..."
                value={searchService}
                onChange={(e) => setSearchService(e.target.value)}
                className="pl-8 text-xs py-2 h-9 rounded-xl"
              />
            </div>

            {/* Categories filter */}
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setSelectedCategory("")}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                  selectedCategory === "" ? "bg-[#02712a] text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Tất cả
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                    selectedCategory === cat.id
                      ? "bg-[#02712a] text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Service Items Grid */}
          <div className="grid gap-2.5 sm:grid-cols-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
            {filteredServices.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-500">
                Không tìm thấy món hoặc dịch vụ phù hợp.
              </div>
            ) : (
              filteredServices.map((svc) => {
                const isLocked = isCurrentBookingLocked;
                const stock = svc.trackInventory ? Number(svc.inventory?.quantity ?? 0) : 999;
                const isOutOfStock = svc.trackInventory && stock <= 0;

                return (
                  <div
                    key={svc.id}
                    onClick={() => {
                      if (!isLocked && !isOutOfStock) handleAddService(svc);
                    }}
                    className={`group relative rounded-2xl border p-3 shadow-xs transition-all duration-200 flex flex-col justify-between select-none ${
                      isLocked || isOutOfStock
                        ? "cursor-not-allowed border-slate-200 bg-slate-50/80 opacity-70"
                        : "cursor-pointer border-slate-200 bg-white hover:border-[#02712a] hover:shadow-md active:scale-95"
                    }`}
                  >
                    <div>
                      {/* Top: Badges */}
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                          {svc.type === "RENTAL_SERVICE" ? "Cho thuê" : svc.unit}
                        </span>
                        {svc.trackInventory && (
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                              isOutOfStock
                                ? "bg-rose-100 text-rose-700"
                                : stock <= 5
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {isOutOfStock ? "Hết hàng" : `Kho: ${stock}`}
                          </span>
                        )}
                      </div>

                      {/* Item Thumbnail & Name — ServiceImage fits the picture inside the box
                          (object-contain) so wide product shots are not cropped. */}
                      <div className="mt-2 flex items-center gap-2">
                        <ServiceImage
                          src={svc.imageUrl}
                          alt={svc.name}
                          className="h-10 w-10 shrink-0 rounded-xl"
                          fallback={
                            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                              <Package className="h-5 w-5" />
                            </div>
                          }
                        />
                        <h3 className="font-black text-slate-900 text-xs line-clamp-2 group-hover:text-[#02712a] transition">
                          {svc.name}
                        </h3>
                      </div>
                    </div>

                    {/* Price and Add button */}
                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="font-black text-[#02712a] text-xs">
                        {formatMoney(svc.price)}
                      </span>
                      <button
                        disabled={isLocked || isOutOfStock}
                        className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
                          isLocked || isOutOfStock
                            ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                            : "bg-green-50 text-[#02712a] group-hover:bg-[#02712a] group-hover:text-white"
                        }`}
                      >
                        {isLocked ? <Lock className="h-3 w-3" /> : <Plus className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* =========================================================================
            RIGHT COLUMN: Chi Tiết Đơn Hàng & Bill Realtime & Checkout POS
           ========================================================================= */}
        <div className="lg:col-span-4 space-y-4">
          {selectedBooking ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl flex flex-col justify-between min-h-[calc(100vh-220px)]">
              <div>
                {/* Header: Court details & Customer */}
                <div className="border-b border-slate-100 pb-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-black text-slate-900 text-base flex items-center gap-1.5">
                        {selectedBooking.court.name}
                        {selectedBooking.courtSurface && (
                          <span className="rounded-lg bg-purple-100 text-purple-900 border border-purple-200 px-2 py-0.5 text-xs font-black">
                            {selectedBooking.courtSurface.name}
                          </span>
                        )}
                      </h2>
                    </div>
                    <span className="text-xs font-mono font-black text-[#02712a] bg-green-50 px-2 py-0.5 rounded-lg border border-green-200">
                      #{selectedBooking.bookingCode}
                    </span>
                  </div>

                  {/* Customer info & Check-in bar */}
                  <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <div className="space-y-0.5">
                      <p className="font-extrabold text-slate-900 flex items-center gap-1">
                        <User className="h-3 w-3 text-slate-400" /> {selectedBooking.user.fullName}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {selectedBooking.user.phone || selectedBooking.user.email}
                      </p>
                    </div>

                    {/* Check-in status / button */}
                    {!selectedBooking.checkedInAt ? (
                      <Button
                        size="sm"
                        className="bg-[#02712a] hover:bg-[#1fa955] text-white text-[11px] h-7 px-2.5 font-bold shadow-xs"
                        onClick={handleCheckIn}
                      >
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Check-in
                      </Button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-1 rounded-md">
                        <Check className="h-3 w-3" /> Đã check-in
                      </span>
                    )}
                  </div>
                </div>

                {/* Lock invoice banner */}
                {isCurrentBookingLocked ? (
                  <div className="mt-2.5 flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 p-2 text-xs text-emerald-900">
                    <span className="flex items-center gap-1 font-extrabold">
                      <Lock className="h-3.5 w-3.5 text-[#02712a]" /> HÓA ĐƠN ĐÃ KHÓA
                    </span>
                    <button
                      onClick={() => setIsUnlockConfirmOpen(true)}
                      className="text-[11px] font-bold text-slate-600 hover:text-slate-900 hover:underline flex items-center gap-0.5"
                    >
                      <Unlock className="h-3 w-3" /> Mở khóa
                    </button>
                  </div>
                ) : (
                  <div className="mt-2.5 flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800">
                    <span className="text-[11px] font-medium">Chế độ sửa dịch vụ</span>
                    <button
                      onClick={() => toggleLockInvoice(selectedBooking.id, true)}
                      className="flex items-center gap-1 rounded-md bg-[#02712a] px-2 py-0.5 text-[10px] font-extrabold text-white"
                    >
                      <Lock className="h-2.5 w-2.5" /> Khóa bill
                    </button>
                  </div>
                )}

                {/* Services list in booking */}
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <h3 className="font-black uppercase text-slate-600 tracking-wider">
                      Dịch vụ đã dùng ({selectedBooking.services?.length || 0})
                    </h3>
                  </div>

                  {selectedBooking.services?.length === 0 ? (
                    <div className="rounded-xl bg-slate-50 p-5 text-center text-xs text-slate-400 border border-dashed border-slate-200">
                      Chưa có dịch vụ nào trong đơn. Chọn món ở cột giữa để thêm vào hóa đơn.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                      {selectedBooking.services.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 border border-slate-200"
                        >
                          <div className="flex-1 pr-2">
                            <p className="text-xs font-bold text-slate-900 line-clamp-1">
                              {item.name || item.service?.name || "Dịch vụ"}
                            </p>
                            <p className="text-[11px] text-slate-500 font-medium">
                              {formatMoney(item.unitPrice || item.price)} x {item.quantity} ={" "}
                              <strong className="text-[#02712a]">
                                {formatMoney(Number(item.unitPrice || item.price) * item.quantity)}
                              </strong>
                            </p>

                            {/* Rental item status badge */}
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
                                      setSelectedRental({ id: rental.id, name: item.name || item.service?.name || "Thiết bị" });
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

                          {/* Quantity control */}
                          <div className="flex items-center gap-1">
                            <button
                              disabled={isCurrentBookingLocked}
                              onClick={() => handleUpdateQuantity(item.serviceId || item.id, item.quantity, -1)}
                              className={`flex h-6 w-6 items-center justify-center rounded-md border text-xs transition ${
                                isCurrentBookingLocked
                                  ? "bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed"
                                  : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100 active:scale-95"
                              }`}
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="text-xs font-black w-4 text-center text-slate-900">{item.quantity}</span>
                            <button
                              disabled={isCurrentBookingLocked}
                              onClick={() => handleUpdateQuantity(item.serviceId || item.id, item.quantity, 1)}
                              className={`flex h-6 w-6 items-center justify-center rounded-md border text-xs transition ${
                                isCurrentBookingLocked
                                  ? "bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed"
                                  : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100 active:scale-95"
                              }`}
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                            <button
                              disabled={isCurrentBookingLocked}
                              onClick={() => handleRemoveService(item.serviceId || item.id)}
                              className={`ml-1 p-1 transition ${
                                isCurrentBookingLocked ? "text-slate-300 cursor-not-allowed" : "text-slate-400 hover:text-rose-600"
                              }`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom: Totals & Checkout Button */}
              <div className="space-y-3 border-t border-slate-100 pt-3 mt-3">
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Tiền thuê sân:</span>
                    <span className="font-bold text-slate-900">{formatMoney(selectedBooking.courtSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Tiền dịch vụ đã dùng:</span>
                    <span className="font-bold text-slate-900">{formatMoney(selectedBooking.serviceSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Tiền cọc / Đã trả trước:</span>
                    <span className="font-bold text-blue-600">-{formatMoney(selectedBooking.depositPaid)}</span>
                  </div>
                  <div className="flex justify-between items-baseline text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                    <span>CÒN PHẢI THU:</span>
                    <span className="text-xl font-black text-[#02712a]">
                      {formatMoney(selectedBooking.remainingAmount)}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  {selectedBooking.remainingAmount > 0 ? (
                    <Button
                      className="w-full h-12 bg-[#02712a] text-white font-black text-sm shadow-md hover:bg-[#1fa955] transition flex items-center justify-center gap-2"
                      onClick={handleOpenCheckoutModal}
                    >
                      <CreditCard className="h-4 w-4" /> THANH TOÁN / CHECKOUT ({formatMoney(selectedBooking.remainingAmount)})
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 text-center text-xs font-black text-emerald-800 flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-[#02712a]" /> ĐÃ THANH TOÁN ĐỦ 100%
                      </div>
                      <Button
                        variant="secondary"
                        className="w-full h-10 border-slate-300 text-slate-800 text-xs font-extrabold flex items-center justify-center gap-2"
                        onClick={() => {
                          setReceiptData({
                            booking: selectedBooking,
                            paidAmount: selectedBooking.totalAmount,
                            paymentMethod: "Đã thanh toán trước",
                            paidAt: new Date().toLocaleString("vi-VN")
                          });
                        }}
                      >
                        <Printer className="h-3.5 w-3.5" /> Xem phiếu thu / In hóa đơn
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
              Vui lòng chọn một đơn đặt sân ở cột bên trái để quản lý thu ngân.
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          CHECKOUT & PAYMENT MODAL (CASH, BANK TRANSFER, VIETQR)
         ========================================================================= */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={`Thanh toán đơn #${selectedBooking?.bookingCode}`}
        maxWidth="max-w-md"
      >
        {selectedBooking && (
          <div className="space-y-4 pt-2">
            {/* Amount Summary */}
            <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 space-y-1 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Khách hàng:</span>
                <strong className="text-slate-900">{selectedBooking.user.fullName}</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Sân:</span>
                <span className="font-bold text-slate-900">
                  {selectedBooking.court.name} {selectedBooking.courtSurface?.name ? `(${selectedBooking.courtSurface.name})` : ""}
                </span>
              </div>
              <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-200 font-extrabold">
                <span>Số tiền cần thu:</span>
                <span className="text-base text-[#02712a] font-black">{formatMoney(selectedBooking.remainingAmount)}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
                Phương thức thanh toán
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("CASH")}
                  className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-xs font-extrabold transition ${
                    paymentMethod === "CASH"
                      ? "border-[#02712a] bg-green-50 text-[#02712a] shadow-xs"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Banknote className="h-5 w-5" /> Tiền mặt
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("BANK_TRANSFER")}
                  className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-xs font-extrabold transition ${
                    paymentMethod === "BANK_TRANSFER"
                      ? "border-[#02712a] bg-green-50 text-[#02712a] shadow-xs"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <CreditCard className="h-5 w-5" /> Chuyển khoản
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("QR_TRANSFER")}
                  className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-xs font-extrabold transition ${
                    paymentMethod === "QR_TRANSFER"
                      ? "border-[#02712a] bg-green-50 text-[#02712a] shadow-xs"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <QrCode className="h-5 w-5" /> Quét VietQR
                </button>
              </div>
            </div>

            {/* Payment Method Details */}
            {paymentMethod === "CASH" && (
              <div className="space-y-3 rounded-xl bg-slate-50 p-3.5 border border-slate-200 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tiền khách đưa (VND):</label>
                  <Input
                    type="number"
                    value={cashGiven || ""}
                    onChange={(e) => setCashGiven(Number(e.target.value))}
                    placeholder="Nhập số tiền khách đưa..."
                    className="font-black text-sm"
                  />
                </div>

                {/* Quick cash chips */}
                <div className="flex flex-wrap gap-1">
                  {[
                    { label: "Đủ tiền", val: selectedBooking.remainingAmount },
                    { label: "+10k", val: selectedBooking.remainingAmount + 10000 },
                    { label: "+20k", val: selectedBooking.remainingAmount + 20000 },
                    { label: "+50k", val: selectedBooking.remainingAmount + 50000 },
                    { label: "200k", val: 200000 },
                    { label: "500k", val: 500000 }
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCashGiven(chip.val)}
                      className="px-2 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {/* Change calculation */}
                <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline font-black">
                  <span>Tiền thừa trả khách:</span>
                  <span
                    className={`text-base ${
                      cashGiven >= selectedBooking.remainingAmount ? "text-[#02712a]" : "text-rose-600"
                    }`}
                  >
                    {cashGiven >= selectedBooking.remainingAmount
                      ? formatMoney(cashGiven - selectedBooking.remainingAmount)
                      : `Còn thiếu: ${formatMoney(selectedBooking.remainingAmount - cashGiven)}`}
                  </span>
                </div>
              </div>
            )}

            {paymentMethod === "BANK_TRANSFER" && (
              <div className="space-y-2 rounded-xl bg-slate-50 p-3 border border-slate-200 text-xs">
                <p className="font-bold text-slate-800">Thông tin chuyển khoản sân:</p>
                <div className="space-y-1 bg-white p-2.5 rounded-lg border border-slate-200 text-[11px]">
                  <p>Ngân hàng: <strong>MB Bank (Ngân hàng Quân Đội)</strong></p>
                  <p>Số tài khoản: <strong className="text-base text-blue-700 font-mono">0396445585</strong></p>
                  <p>Chủ tài khoản: <strong>SPORTS BOOKING SYSTEM</strong></p>
                  <p>
                    Nội dung CK: <strong className="text-[#02712a] font-mono">BK {selectedBooking.bookingCode}</strong>
                  </p>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mt-2 mb-1">Mã giao dịch / Ghi chú (nếu có):</label>
                  <Input
                    placeholder="VD: MB12345678..."
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                  />
                </div>
              </div>
            )}

            {paymentMethod === "QR_TRANSFER" && (
              <div className="space-y-3 rounded-xl bg-slate-50 p-3.5 border border-slate-200 text-center">
                <p className="text-xs font-bold text-slate-700">Quét mã QR để thanh toán chính xác:</p>
                <div className="flex justify-center">
                  <img
                    src={`https://img.vietqr.io/image/970422-0396445585-compact2.png?amount=${selectedBooking.remainingAmount}&addInfo=${encodeURIComponent(
                      selectedBooking.bookingCode
                    )}&accountName=SPORTS%20BOOKING%20SYSTEM`}
                    alt="VietQR"
                    className="h-44 w-44 rounded-xl border border-slate-300 shadow-sm bg-white p-1 object-contain"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Số tiền: <strong>{formatMoney(selectedBooking.remainingAmount)}</strong> | Nội dung: <strong>{selectedBooking.bookingCode}</strong>
                </p>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="secondary" onClick={() => setIsPaymentModalOpen(false)}>
                Hủy
              </Button>
              <Button
                type="button"
                className="bg-[#02712a] text-white font-extrabold px-5"
                disabled={isProcessingPayment || (paymentMethod === "CASH" && cashGiven < selectedBooking.remainingAmount)}
                onClick={handleProcessPayment}
              >
                {isProcessingPayment ? "Đang xử lý..." : "Xác nhận thanh toán"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* =========================================================================
          RECEIPT MODAL (In Phiếu Thu / Xem Hóa Đơn)
         ========================================================================= */}
      <Modal
        isOpen={Boolean(receiptData)}
        onClose={() => setReceiptData(null)}
        title="Phiếu Thu / Hóa Đơn Thu Ngân"
        maxWidth="max-w-md"
      >
        {receiptData && (
          <div className="space-y-4 pt-1" id="printable-receipt">
            <div className="text-center pb-3 border-b border-dashed border-slate-300">
              <h3 className="font-black text-slate-900 text-base">HỆ THỐNG ĐẶT SÂN THỂ THAO</h3>
              <p className="text-xs text-slate-500">PHIẾU THU TIỀN DỊCH VỤ & THUÊ SÂN</p>
              <p className="text-[11px] font-mono text-slate-400 mt-1">Mã đơn: #{receiptData.booking.bookingCode}</p>
            </div>

            <div className="space-y-1 text-xs text-slate-700">
              <p>Khách hàng: <strong>{receiptData.booking.user.fullName}</strong> ({receiptData.booking.user.phone || receiptData.booking.user.email})</p>
              <p>Sân bóng: <strong>{receiptData.booking.court.name}</strong> {receiptData.booking.courtSurface ? ` - ${receiptData.booking.courtSurface.name}` : ""}</p>
              <p>Thời gian chơi: {receiptData.booking.startTime.slice(0, 5)} - {receiptData.booking.endTime.slice(0, 5)}</p>
              <p>Thời gian thanh toán: {receiptData.paidAt}</p>
              <p>Hình thức: <strong>{receiptData.paymentMethod}</strong> {receiptData.transactionId ? `(${receiptData.transactionId})` : ""}</p>
            </div>

            {/* Items Table */}
            <div className="border-t border-b border-dashed border-slate-300 py-2 space-y-1 text-xs">
              <div className="flex justify-between font-bold text-slate-900">
                <span>Hạng mục</span>
                <span>Thành tiền</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tiền thuê sân</span>
                <span>{formatMoney(receiptData.booking.courtSubtotal)}</span>
              </div>
              {receiptData.booking.services?.map((s) => (
                <div key={s.id} className="flex justify-between text-slate-600">
                  <span>
                    {s.name || s.service?.name} x {s.quantity}
                  </span>
                  <span>{formatMoney(Number(s.unitPrice || s.price) * s.quantity)}</span>
                </div>
              ))}
              {receiptData.booking.depositPaid > 0 && (
                <div className="flex justify-between text-blue-600 font-medium">
                  <span>Đã đặt cọc</span>
                  <span>-{formatMoney(receiptData.booking.depositPaid)}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between text-sm font-black text-slate-900">
              <span>TỔNG TIỀN ĐÃ THU:</span>
              <span className="text-base text-[#02712a] font-black">{formatMoney(receiptData.paidAmount)}</span>
            </div>

            <div className="text-center text-[10px] text-slate-400 pt-2 border-t border-slate-100">
              Cảm ơn quý khách đã sử dụng dịch vụ! Chúc quý khách có những trận đấu tuyệt vời!
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 print:hidden">
              <Button
                type="button"
                variant="secondary"
                className="flex items-center gap-1.5"
                onClick={() => window.print()}
              >
                <Printer className="h-4 w-4" /> In hóa đơn
              </Button>
              <Button
                type="button"
                className="bg-[#02712a] text-white font-bold"
                onClick={() => setReceiptData(null)}
              >
                Hoàn tất
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Unlock Invoice Confirm Modal */}
      <Modal
        isOpen={isUnlockConfirmOpen}
        onClose={() => setIsUnlockConfirmOpen(false)}
        title="Mở khóa hóa đơn?"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4 pt-2">
          <p className="text-sm text-slate-600">
            Bạn có chắc chắn muốn mở khóa hóa đơn để chỉnh sửa dịch vụ cho đơn đặt sân này?
          </p>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setIsUnlockConfirmOpen(false)}>
              Hủy
            </Button>
            <Button
              type="button"
              className="bg-[#02712a] text-white font-bold"
              onClick={() => {
                if (selectedBooking) toggleLockInvoice(selectedBooking.id, false);
                setIsUnlockConfirmOpen(false);
              }}
            >
              Mở khóa
            </Button>
          </div>
        </div>
      </Modal>

      {/* Return Rental Item Modal */}
      <Modal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        title={`Xử Lý Trả Thiết Bị - ${selectedRental?.name}`}
      >
        <form onSubmit={handleReturnRental} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
              Trạng thái hoàn trả (*)
            </label>
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
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
              Ghi chú hỏng/mất (nếu có)
            </label>
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
