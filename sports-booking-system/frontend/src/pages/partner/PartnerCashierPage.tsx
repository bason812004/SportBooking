import { useEffect, useRef, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layers, Printer, Receipt, RefreshCw, Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast as notify } from "sonner";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import {
  cashierApi,
  type CashierBooking,
  type CashierBookingDetail
} from "../../features/cashier/api/cashierApi";
import { phaseAllowsServices, sessionCourtLabel, sessionPhase } from "../../features/cashier/cashierSession";
import { ServiceMenu } from "../../features/cashier/components/ServiceMenu";
import { SessionBill } from "../../features/cashier/components/SessionBill";
import { SessionCard } from "../../features/cashier/components/SessionCard";
import type { SessionPaid } from "../../features/cashier/components/SessionPayment";
import { serviceApi, type ServiceCategory, type ServiceItem } from "../../features/services/api/serviceApi";
import { partnerApi } from "../../features/partner/api/partnerApi";
import { getSocket } from "../../lib/socket";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { formatMoney } from "../../utils/formatters";

type BookingFilterType = "ALL" | "IN_USE" | "UPCOMING" | "UNPAID" | "PAID" | "COMPLETED";

/** The views besides the sessions in play. */
const OTHER_FILTERS: Array<{ key: Exclude<BookingFilterType, "IN_USE">; label: string }> = [
  { key: "UPCOMING", label: "Sắp tới" },
  { key: "UNPAID", label: "Chưa trả" },
  { key: "PAID", label: "Đã trả" },
  { key: "COMPLETED", label: "Hoàn tất" },
  { key: "ALL", label: "Tất cả hôm nay" }
];

/** A booking loaded on its own (opened by link) in the shape of a counter list row. */
function bookingFromDetail(detail: CashierBookingDetail): CashierBooking {
  return {
    ...detail.booking,
    services: detail.activeServices,
    courtSubtotal: detail.courtSubtotal,
    serviceSubtotal: detail.serviceSubtotal,
    totalAmount: detail.grandTotal,
    depositPaid: detail.depositPaid,
    remainingAmount: detail.remainingAmount
  };
}

export function PartnerCashierPage() {
  const { token, user } = useAuth();

  // Booking list & selection
  const [activeBookings, setActiveBookings] = useState<CashierBooking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<CashierBooking | null>(null);

  // ?bookingId= (the "Dịch vụ (POS)" button of the bookings pages) opens that booking. One the counter list does not
  // hold (another day's) is loaded on its own and pinned at the top, also across the periodic refreshes.
  const [searchParams] = useSearchParams();
  const requestedBookingId = searchParams.get("bookingId");
  const [pinnedBookingId, setPinnedBookingId] = useState<string | null>(null);
  const pinnedIdRef = useRef<string | null>(requestedBookingId);
  const selectOnLoadRef = useRef<string | null>(requestedBookingId);
  const firstRequestRef = useRef(true);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);

  // Filters & Search
  const [searchBooking, setSearchBooking] = useState("");
  // The counter sells to customers on court: it opens on the sessions in play, the rest are secondary filters.
  const [bookingFilter, setBookingFilter] = useState<BookingFilterType>("IN_USE");
  // A partner with several venues narrows the list to one ("" = all of them). Staff run one venue: the server
  // pins their list to it, so they get no such filter.
  const isPartner = user?.role === "PARTNER";
  const [venueFilter, setVenueFilter] = useState("");
  const venues = useQuery({ queryKey: ["partner-courts"], queryFn: partnerApi.courts, enabled: isPartner, staleTime: 5 * 60_000 });
  const venueOptions = isPartner ? venues.data ?? [] : [];
  const [loading, setLoading] = useState(true);
  const [searchService, setSearchService] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  // The app-wide toasts (sonner), like every other page.
  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    if (type === "error") notify.error(message);
    else if (type === "info") notify.info(message);
    else notify.success(message);
  };

  // The lock is kept on the booking, so every device and staff member sees it and the server enforces it.
  const isCurrentBookingLocked = Boolean(selectedBooking?.invoiceLockedAt);
  const [lockPending, setLockPending] = useState(false);

  const toggleLockInvoice = async (bookingId: string, lockState: boolean) => {
    setLockPending(true);
    try {
      const result = await cashierApi.setInvoiceLock(bookingId, lockState);
      const patchLock = (booking: CashierBooking) => (booking.id === bookingId ? { ...booking, invoiceLockedAt: result.invoiceLockedAt } : booking);
      setSelectedBooking((prev) => (prev ? patchLock(prev) : prev));
      setActiveBookings((prev) => prev.map(patchLock));
      showToast(lockState ? "Đã kết thúc phiên: dịch vụ được khoá, chuyển sang thu tiền" : "Đã mở lại phiên để thêm dịch vụ", lockState ? "success" : "info");
    } catch (err: any) {
      showToast(err.message || "Không đổi được trạng thái phiên", "error");
    } finally {
      setLockPending(false);
    }
  };

  // Modals state
  const [isUnlockConfirmOpen, setIsUnlockConfirmOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedRental, setSelectedRental] = useState<{ id: string; name: string } | null>(null);
  const [returnStatus, setReturnStatus] = useState<"RETURNED" | "DAMAGED" | "LOST">("RETURNED");
  const [returnNotes, setReturnNotes] = useState("");

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
        cashierApi.getActiveBookings(isPartner ? venueFilter || undefined : undefined, searchBooking, bookingFilter),
        serviceApi.getCategories()
      ]);
      const listed = await withPinnedBooking(bookings);
      setActiveBookings(listed);
      const wanted = selectOnLoadRef.current;
      selectOnLoadRef.current = null;
      setSelectedBooking((prev) => {
        if (wanted) return listed.find((b) => b.id === wanted || b.bookingCode === wanted) ?? prev ?? listed[0] ?? null;
        if (!prev) return listed.length > 0 ? listed[0] : null;
        if (hasAnyPendingWork()) return prev;
        const found = listed.find((b) => b.id === prev.id);
        if (found) return found;
        // A session just finished leaves the "Đang chơi" list but stays open (its receipt) until another is picked.
        if (prev.bookingStatus === "COMPLETED") return prev;
        return listed.length > 0 ? listed[0] : null;
      });
      setCategories(cats);
    } catch (err) {
      console.error("Failed to load cashier data:", err);
      if (!silent) showToast("Lỗi tải dữ liệu thu ngân", "error");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // The booking opened by link, put in front of the list when the list does not hold it.
  async function withPinnedBooking(bookings: CashierBooking[]) {
    const id = pinnedIdRef.current;
    if (!id || bookings.some((b) => b.id === id || b.bookingCode === id)) {
      setPinnedBookingId(null);
      return bookings;
    }
    const detail = await cashierApi.getBookingDetail(id).catch((err: Error) => {
      showToast(err.message || "Không mở được đơn này ở quầy thu ngân", "error");
      return null;
    });
    if (!detail) {
      pinnedIdRef.current = null;
      setPinnedBookingId(null);
      return bookings;
    }
    const pinned = bookingFromDetail(detail);
    pinnedIdRef.current = pinned.id;
    setPinnedBookingId(pinned.id);
    return [pinned, ...bookings];
  }

  // A link to another booking while the counter is open: select it (the first one is handled by the first load).
  useEffect(() => {
    if (firstRequestRef.current) {
      firstRequestRef.current = false;
      return;
    }
    if (!requestedBookingId) return;
    pinnedIdRef.current = requestedBookingId;
    selectOnLoadRef.current = requestedBookingId;
    fetchData();
  }, [requestedBookingId]);

  // Re-fetch when booking filter or search changes (debounced search)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 250);
    return () => clearTimeout(timer);
  }, [bookingFilter, searchBooking, venueFilter]);

  // Periodic silent polling
  useEffect(() => {
    const interval = setInterval(() => fetchData(true), 25000);
    return () => clearInterval(interval);
  }, [bookingFilter, searchBooking, venueFilter]);

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

  // Check-in action handler. Same rule as the staff counter screen: arriving before the booked time follows the
  // court's early check-in policy, which may add a charge to the bill.
  const handleCheckIn = async () => {
    if (!selectedBooking) return;
    const bookingId = selectedBooking.id;
    try {
      const result = await cashierApi.checkInBooking(bookingId);
      const extra = Number(result?.extraChargeAmount ?? 0);
      showToast(
        extra > 0
          ? `Đã check-in sớm, hoá đơn tính thêm ${formatMoney(extra)} theo chính sách vào sớm của sân.`
          : `Khách đã check-in vào ${selectedBooking.courtSurface?.name || selectedBooking.court.name} thành công!`,
        "success"
      );
      setSelectedBooking((prev) => (prev ? { ...prev, checkedInAt: new Date().toISOString(), bookingStatus: "IN_PROGRESS" } : prev));
      setActiveBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, checkedInAt: new Date().toISOString(), bookingStatus: "IN_PROGRESS" } : b))
      );
      if (extra > 0) {
        const detail = await cashierApi.getBookingDetail(bookingId).catch(() => null);
        if (detail) {
          lastAppliedAtRef.current = Date.now();
          applyTotals(bookingId, detail);
        }
      }
    } catch (err: any) {
      showToast(err.message || "Lỗi check-in", "error");
    }
  };

  const filteredServices = useMemo(() => {
    return services.filter((svc) => {
      const matchesSearch = svc.name.toLowerCase().includes(searchService.toLowerCase());
      const matchesCat = !selectedCategory || svc.categoryId === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [services, searchService, selectedCategory]);

  // The clock the session states follow ("Đang chơi" turns "Hết giờ" by itself).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const [actionPending, setActionPending] = useState(false);
  const role = user?.role;
  const selectedPhase = selectedBooking ? sessionPhase(selectedBooking, now) : null;

  /** The selected session's bill as the server has it now. */
  const refreshSelectedTotals = async () => {
    if (!selectedBooking) return;
    const bookingId = selectedBooking.id;
    const detail = await cashierApi.getBookingDetail(bookingId).catch(() => null);
    if (detail) {
      lastAppliedAtRef.current = Date.now();
      applyTotals(bookingId, detail);
    }
  };

  // Ending a session locks its services (the server refuses changes on every device); the bill then asks for the
  // money, or to finish the session when nothing is owed. Reopening unlocks it.
  const handleEndSession = async () => {
    if (!selectedBooking || hasAnyPendingWork()) {
      if (selectedBooking) showToast("Đang lưu dịch vụ vừa thêm, thử lại sau giây lát", "info");
      return;
    }
    await toggleLockInvoice(selectedBooking.id, true);
    await refreshSelectedTotals();
  };

  /** Nothing owed: the session finishes here (with money owed, the payment finishes it). */
  const handleFinish = async () => {
    if (!selectedBooking) return;
    const bookingId = selectedBooking.id;
    setActionPending(true);
    try {
      await cashierApi.finishSession(bookingId);
      const finish = (booking: CashierBooking) => (booking.id === bookingId ? { ...booking, bookingStatus: "COMPLETED" } : booking);
      setSelectedBooking((prev) => (prev ? finish(prev) : prev));
      setActiveBookings((prev) => prev.map(finish));
      showToast("Đã hoàn tất phiên sân", "success");
    } catch (err: any) {
      showToast(err.message || "Không hoàn tất được phiên", "error");
      await refreshSelectedTotals();
    } finally {
      setActionPending(false);
    }
  };

  /** The payment step recorded a payment: show what the server kept, and the receipt. */
  const handlePaid = (paid: SessionPaid) => {
    if (!selectedBooking) return;
    const updated: CashierBooking = {
      ...selectedBooking,
      remainingAmount: paid.stillDue,
      paidAtCounter: Number(selectedBooking.paidAtCounter ?? 0) + paid.amount,
      paymentStatus: paid.isCompleted ? "PAID" : selectedBooking.paymentStatus,
      bookingStatus: paid.isCompleted ? "COMPLETED" : "CHECKOUT_PENDING"
    };
    setSelectedBooking(updated);
    setActiveBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    setReceiptData({
      booking: updated,
      paidAmount: paid.amount,
      paymentMethod: paid.methodLabel,
      paidAt: new Date().toLocaleString("vi-VN"),
      transactionId: paid.transactionId
    });
    showToast(
      paid.isCompleted ? "Đã thu tiền, phiên sân hoàn tất." : `Đã ghi nhận thanh toán. Còn phải thu ${formatMoney(paid.stillDue)}.`,
      paid.isCompleted ? "success" : "info"
    );
  };

  const otherFilter = bookingFilter === "IN_USE" ? "" : bookingFilter;
  const blockedReason = !selectedBooking
    ? "Chọn một phiên sân ở cột trái để thêm dịch vụ."
    : selectedPhase && !phaseAllowsServices(selectedPhase)
      ? selectedPhase === "COMPLETED"
        ? "Phiên đã hoàn tất, không thêm dịch vụ được nữa."
        : "Phiên đã kết thúc. Bấm “Mở lại phiên” ở hoá đơn để thêm dịch vụ."
      : null;
  const selectedCourt = selectedBooking ? sessionCourtLabel(selectedBooking, role) : null;

  // Fills the screen's height; takes 32px of the layout's 48px bottom padding (taller by 32px, pulled up by -mb-8),
  // so 16px stay below it and the page still does not scroll.
  return (
    <div className="flex flex-col gap-4 lg:-mb-8 lg:h-[calc(100dvh-5.75rem)] lg:min-h-[36rem]">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-lg font-black text-slate-900">
            <span className="rounded-xl bg-green-100 p-1.5 text-[#02712a]">
              <Receipt className="h-4 w-4" />
            </span>
            Thu ngân · Phiên sân đang chơi
          </h1>
          <p className="mt-0.5 hidden text-xs text-slate-500 sm:block">Chọn phiên, thêm dịch vụ khách dùng, kết thúc phiên rồi thu tiền.</p>
        </div>
        <Button variant="secondary" className="shrink-0 text-xs font-bold" onClick={() => fetchData()}>
          <RefreshCw className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Đồng bộ</span>
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[18rem_minmax(0,1fr)_20rem] xl:grid-cols-[22rem_minmax(0,1fr)_24rem] lg:grid-rows-[minmax(0,1fr)]">
        {/* Left: the sessions. */}
        <section className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="space-y-2.5 border-b border-slate-100 p-3">
            <h2 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-700">
              <Layers className="h-4 w-4 text-[#02712a]" /> Phiên sân ({activeBookings.length})
            </h2>
            {venueOptions.length > 1 ? (
              <select
                aria-label="Cụm sân"
                value={venueFilter}
                onChange={(e) => setVenueFilter(e.target.value)}
                className={`h-9 w-full rounded-xl border px-2.5 text-xs font-semibold outline-none focus:border-[#02712a] ${
                  venueFilter ? "border-[#02712a] bg-green-50 text-[#02712a]" : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                <option value="">Tất cả cụm sân</option>
                {venueOptions.map((venue) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name}
                  </option>
                ))}
              </select>
            ) : null}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Tên khách, SĐT, sân, mã đơn"
                value={searchBooking}
                onChange={(e) => setSearchBooking(e.target.value)}
                className="h-9 rounded-xl py-2 pl-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBookingFilter("IN_USE")}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
                  bookingFilter === "IN_USE" ? "bg-[#02712a] text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Đang chơi
              </button>
              <select
                aria-label="Bộ lọc khác"
                value={otherFilter}
                onChange={(e) => setBookingFilter((e.target.value || "IN_USE") as BookingFilterType)}
                className={`h-8 min-w-0 flex-1 rounded-lg border px-2 text-xs font-semibold outline-none focus:border-[#02712a] ${
                  otherFilter ? "border-[#02712a] bg-green-50 text-[#02712a]" : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                <option value="">Bộ lọc khác…</option>
                {OTHER_FILTERS.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="max-h-[24rem] min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5 lg:max-h-none">
            {loading ? (
              [1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-100" />)
            ) : activeBookings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
                {bookingFilter === "IN_USE" && !searchBooking.trim() ? (
                  <>
                    <p className="font-semibold text-slate-600">Chưa có khách nào đang chơi.</p>
                    <p className="mt-1">Phiên sắp tới nằm ở “Bộ lọc khác”.</p>
                  </>
                ) : (
                  "Không có phiên nào phù hợp."
                )}
              </div>
            ) : (
              activeBookings.map((b) => (
                <SessionCard
                  key={b.id}
                  booking={b}
                  phase={sessionPhase(b, now)}
                  role={role}
                  selected={selectedBooking?.id === b.id}
                  pinned={b.id === pinnedBookingId}
                  onSelect={() => setSelectedBooking(b)}
                />
              ))
            )}
          </div>
        </section>

        {/* Middle: add services to the selected session. */}
        <ServiceMenu
          courtLabel={selectedCourt ? selectedCourt.main : null}
          services={selectedBooking ? filteredServices : []}
          categories={categories}
          category={selectedCategory}
          onCategory={setSelectedCategory}
          search={searchService}
          onSearch={setSearchService}
          blockedReason={blockedReason}
          onAdd={handleAddService}
        />

        {/* Right: the session's bill, ending with its payment. */}
        {selectedBooking && selectedPhase ? (
          <SessionBill
            booking={selectedBooking}
            phase={selectedPhase}
            role={role}
            now={now}
            busy={actionPending || lockPending}
            onCheckIn={async () => {
              setActionPending(true);
              await handleCheckIn();
              setActionPending(false);
            }}
            onEndSession={handleEndSession}
            onReopen={() => setIsUnlockConfirmOpen(true)}
            onFinish={handleFinish}
            onQuantity={handleUpdateQuantity}
            onRemove={handleRemoveService}
            onReturnRental={(rental) => {
              setSelectedRental(rental);
              setReturnStatus("RETURNED");
              setReturnNotes("");
              setIsReturnModalOpen(true);
            }}
            onPaid={handlePaid}
            onRefreshTotals={refreshSelectedTotals}
            onPaymentError={(message) => showToast(message, "error")}
            onReceipt={() =>
              setReceiptData({
                booking: selectedBooking,
                paidAmount: Number(selectedBooking.paidAtCounter ?? 0) || selectedBooking.totalAmount,
                paymentMethod: Number(selectedBooking.paidAtCounter ?? 0) > 0 ? "Tại quầy" : "Đã thanh toán trước",
                paidAt: new Date().toLocaleString("vi-VN")
              })
            }
          />
        ) : (
          <div className="flex min-h-[16rem] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            Chọn một phiên sân ở cột trái để xem hoá đơn.
          </div>
        )}
      </div>

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

      {/* Reopening an ended session unlocks its services. */}
      <Modal
        isOpen={isUnlockConfirmOpen}
        onClose={() => setIsUnlockConfirmOpen(false)}
        title="Mở lại phiên?"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4 pt-2">
          <p className="text-sm text-slate-600">
            Phiên sẽ quay lại trạng thái đang chơi để thêm, sửa hoặc bớt dịch vụ. Kết thúc phiên lại khi khách xong.
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
              Mở lại phiên
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
