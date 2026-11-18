import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LogIn, LogOut, PhoneCall, RefreshCcw, ShoppingBag, TimerReset } from "lucide-react";
import { recipientApi, type RecipientOperationItem } from "../../features/recipient/api/recipientApi";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { TopBarActions } from "../../components/layout/TopBarActions";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { ConfirmModal } from "../../components/common/ConfirmModal";
import { AffectedBookingsModal } from "../../features/partner/components/AffectedBookingsModal";
import { useBalanceDueRedirect } from "../../features/cashier/hooks/useBalanceDueRedirect";
import { useWalkInBooking, WalkInDetailsFields } from "../../features/recipient/components/WalkInBookingForm";
import type { ServiceTarget } from "../../features/recipient/components/StaffScheduleGrid";
import { CourtTimelineBoard } from "../../features/recipient/components/CourtTimelineBoard";
import { LiveBookingBillSummary, LiveBookingServicePanel } from "../../features/cashier/components/LiveBookingServicePanel";
import { useLiveBookingServices } from "../../features/cashier/hooks/useLiveBookingServices";
import { formatYmd } from "../../features/bookings/components/BookingCalendar/utils";
import { formatMoney } from "../../utils/formatters";
import { surfaceShortName } from "../../lib/courtNames";

const statusMeta: Record<RecipientOperationItem["status"], { label: string; className: string; dotClassName: string }> = {
  AVAILABLE: { label: "Sân trống", className: "border-emerald-200 bg-emerald-50 text-emerald-700", dotClassName: "bg-emerald-500" },
  OCCUPIED: { label: "Đang có khách", className: "border-blue-200 bg-blue-50 text-blue-700", dotClassName: "bg-blue-500" },
  ENDING_SOON: { label: "Sắp hết giờ", className: "border-amber-200 bg-amber-50 text-amber-700", dotClassName: "bg-amber-500" },
  OVERDUE: { label: "Quá giờ chưa trả sân", className: "border-red-200 bg-red-50 text-red-700", dotClassName: "bg-red-500" },
  RESERVED_SOON: { label: "Sắp có khách", className: "border-indigo-200 bg-indigo-50 text-indigo-700", dotClassName: "bg-indigo-500" },
  INACTIVE: { label: "Tạm ngưng", className: "border-slate-200 bg-slate-100 text-slate-600", dotClassName: "bg-slate-400" }
};

const extendOptions = [15, 30, 60];
// Local date, not toISOString() (UTC): before 07:00 in Vietnam that would still be yesterday.
const todayValue = () => formatYmd(new Date());

export function RecipientCourtSurfacesPage() {
  const queryClient = useQueryClient();
  const [selectedSurfaceId, setSelectedSurfaceId] = useState<string | null>(null);
  const [serviceTarget, setServiceTarget] = useState<ServiceTarget>("walkin");

  const operations = useQuery({
    queryKey: ["recipient-operations"],
    queryFn: () => recipientApi.operations(),
    refetchInterval: 60_000
  });

  const items = operations.data?.items ?? [];
  const selected = useMemo(
    () => items.find((item) => item.surface.id === selectedSurfaceId) ?? items[0] ?? null,
    [items, selectedSurfaceId]
  );

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["recipient-operations"] });
    queryClient.invalidateQueries({ queryKey: ["recipient-surface-availability"] });
    queryClient.invalidateQueries({ queryKey: ["recipient-time-charge-quote"] });
  };

  // Prices on this surface's "+N phút" and "Check-in sớm" buttons, computed by the backend under the
  // partner's policy exactly as it will charge them. Early check-in depends on the clock, hence the refetch.
  const quoteBookingId =
    selected?.status === "OVERDUE" ? selected.latestEndedBooking?.id : (selected?.currentBooking?.id ?? selected?.nextBooking?.id);
  const timeChargeQuote = useQuery({
    queryKey: ["recipient-time-charge-quote", quoteBookingId],
    queryFn: () => recipientApi.timeChargeQuote(quoteBookingId!, extendOptions),
    enabled: Boolean(quoteBookingId),
    refetchInterval: 30_000
  });
  const extensionLabel = (minutes: number) => {
    const amount = timeChargeQuote.data?.extensions.find((item) => item.minutes === minutes)?.amount;
    return amount == null ? `+${minutes} phút` : `+${minutes} phút · ${formatMoney(amount)}`;
  };
  // Past the sub-court's closing time an extension is refused, so its button is off.
  const extensionBlocked = (minutes: number) => timeChargeQuote.data?.extensions.find((item) => item.minutes === minutes)?.allowed === false;
  const earlyQuote = timeChargeQuote.data?.earlyCheckIn ?? null;
  const earlyCheckInHint = !earlyQuote
    ? null
    : !earlyQuote.allowed
      ? earlyQuote.maxMinutes === 0
        ? "Sân không cho check-in sớm, khách đợi đến giờ đặt."
        : `Chỉ được vào sớm tối đa ${earlyQuote.maxMinutes} phút — khách đang sớm ${earlyQuote.earlyMinutes} phút.`
      : earlyQuote.chargedMinutes === 0
        ? `Sớm ${earlyQuote.earlyMinutes} phút — miễn phí.`
        : `Sớm ${earlyQuote.earlyMinutes} phút: miễn phí ${earlyQuote.freeMinutes} phút, tính ${earlyQuote.chargedMinutes} phút · ${formatMoney(earlyQuote.amount)}`;

  // One day for every sub-court row: picking another sub-court keeps the day being looked at.
  const [walkInDate, setWalkInDate] = useState(todayValue());
  useEffect(() => {
    setServiceTarget("walkin");
  }, [selected?.surface.id]);

  const liveBooking = selected?.currentBooking
    ? { id: selected.currentBooking.id, customerName: selected.currentBooking.customerName }
    : null;

  const canBookAdvance = Boolean(selected && selected.surface.status === "ACTIVE");
  // Short names ("Sân 04") in the booking form's list of picked slots: the page is about one venue.
  const venueName = operations.data?.court.name ?? "";
  const surfaceNames = useMemo(
    () => Object.fromEntries(items.map((item) => [item.surface.id, surfaceShortName(item.surface.name, venueName)])),
    [items, venueName]
  );
  const walkIn = useWalkInBooking({
    courtSurfaceId: canBookAdvance ? selected!.surface.id : "",
    courtId: canBookAdvance ? operations.data?.court.id : undefined,
    bookingDate: walkInDate,
    onBookingCreated: refresh,
    enableCustomerLookup: true,
    surfaceNames,
    depositPercent: canBookAdvance ? selected!.surface.depositPercent : undefined
  });

  // Lifted so the catalog (left column) and the bill (right column) share one optimistic overlay —
  // two separate hook calls would leave the bill a round-trip behind every +/- click.
  const liveServices = useLiveBookingServices(liveBooking?.id ?? null, refresh);
  const activeServiceTarget: ServiceTarget = liveBooking ? serviceTarget : "walkin";
  // While a guest on court is being served, the side column is their bill: booking another guest
  // at the same time is not possible anyway.
  const servingLiveGuest = Boolean(liveBooking) && walkIn.showServices && activeServiceTarget === "live";

  // The service panel sits below the surface tiles, so opening it would otherwise leave staff
  // looking at the tiles and having to scroll down on every single order.
  const workAreaRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (walkIn.showServices) workAreaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [walkIn.showServices]);

  // Pausing lists the upcoming bookings first; their customers are told, as when the partner pauses it.
  const [pausing, setPausing] = useState<{ id: string; name: string } | null>(null);
  const affected = useQuery({
    queryKey: ["recipient-surface-affected", pausing?.id],
    queryFn: () => recipientApi.surfaceAffectedBookings(pausing!.id),
    enabled: Boolean(pausing)
  });
  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACTIVE" | "INACTIVE" }) => recipientApi.updateCourtSurfaceStatus(id, status),
    onSuccess: (result) => {
      setPausing(null);
      toast.success(
        result.status === "INACTIVE"
          ? result.notifiedBookings
            ? `Đã tạm ngưng sân con và báo cho ${result.notifiedBookings} khách có lịch sắp tới`
            : "Đã tạm ngưng sân con"
          : "Đã mở lại sân con"
      );
      refresh();
    },
    onError: (error: any) => toast.error(error.message || "Có lỗi xảy ra")
  });

  // Finishing a booking that still owes money opens the cashier on it instead.
  const openCashierIfOwed = useBalanceDueRedirect("/recipient/cashier");
  const [checkingOut, setCheckingOut] = useState<{ id: string; customerName: string } | null>(null);

  const [extendConflict, setExtendConflict] = useState<{
    bookingId: string;
    minutes: number;
    surfaces: Array<{ id: string; name: string }>;
  } | null>(null);

  const extendBooking = useMutation({
    mutationFn: ({ id, minutes, targetSurfaceId }: { id: string; minutes: number; targetSurfaceId?: string }) =>
      recipientApi.extendBooking(id, minutes, targetSurfaceId),
    onSuccess: () => {
      toast.success("Đã gia hạn thời gian chơi cho khách");
      setExtendConflict(null);
      refresh();
    },
    onError: async (error: any, variables) => {
      if (error?.code !== "BOOKING_EXTENSION_CONFLICT" || variables.targetSurfaceId) {
        toast.error(error.message || "Không thể gia hạn, sân đã có lịch sau đó");
        return;
      }
      try {
        const surfaces = await recipientApi.getExtendOptions(variables.id, variables.minutes);
        if (surfaces && surfaces.length > 0) {
          setExtendConflict({ bookingId: variables.id, minutes: variables.minutes, surfaces });
          return;
        }
      } catch {
        // fall through to generic toast below
      }
      toast.error(error.message || "Sân đã có lịch, không còn sân trống để chuyển khách sang");
    }
  });

  const earlyCheckIn = useMutation({
    mutationFn: (bookingId: string) => recipientApi.checkInBooking(bookingId),
    onSuccess: (result) => {
      if (result.extraChargeAmount && result.extraChargeAmount > 0) {
        toast.success(
          `Đã check-in sớm cho khách — cần thu thêm ${formatMoney(result.extraChargeAmount)} do chơi bù thêm giờ (thu qua trang Thu ngân)`
        );
      } else {
        toast.success("Đã check-in sớm cho khách");
      }
      refresh();
    },
    onError: (error: any) => toast.error(error.message || "Không thể check-in sớm")
  });

  const earlyCheckOut = useMutation({
    mutationFn: (bookingId: string) => recipientApi.earlyCheckOutBooking(bookingId),
    onSuccess: () => {
      setCheckingOut(null);
      toast.success("Đã check-out, đơn hoàn thành và phần giờ còn lại được trả lại");
      refresh();
    },
    onError: (error: any, bookingId) => {
      setCheckingOut(null);
      if (openCashierIfOwed(error, bookingId)) return;
      toast.error(error.message || "Không thể check-out");
    }
  });

  const completeOverdue = useMutation({
    mutationFn: (bookingId: string) => recipientApi.completeBooking(bookingId),
    onSuccess: () => {
      toast.success("Đã xác nhận khách trả sân");
      refresh();
    },
    onError: (error: any, bookingId) => {
      if (openCashierIfOwed(error, bookingId)) return;
      toast.error(error.message || "Không thể xác nhận trả sân");
    }
  });

  if (operations.isLoading) return <LoadingState />;
  if (operations.isError) return <ErrorState message={operations.error.message} onRetry={refresh} />;

  const data = operations.data!;

  return (
    <div className="space-y-5">
      {/* In the top bar, next to the bell, rather than in a row of its own. */}
      <TopBarActions>
        <button
          type="button"
          onClick={() => refresh()}
          disabled={operations.isFetching}
          title={`Dữ liệu cập nhật lúc ${data.nowTime} ngày ${new Date(data.date).toLocaleDateString("vi-VN")}`}
          className="inline-flex h-[38px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-wait sm:px-3.5"
        >
          <RefreshCcw className={`h-4 w-4 ${operations.isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
          <span className="hidden sm:inline">Làm mới</span>
          <span className="sr-only sm:hidden">Làm mới</span>
        </button>
      </TopBarActions>

      {/* One panel: picking the sub-court and the time together (one block: days, sub-courts × hours, legend),
          the booking form and the selected sub-court's actions beside it. (Court status counts are on the dashboard.) */}
      {/* On a wide screen the panel fills the screen's height: the booking form stretches to it, and a column longer
          than that scrolls inside. The layout leaves 48px under the content (pb-12); this panel takes 32px of it
          (taller by 32px, pulled up by -mb-8), so 16px stay below it and the page still does not scroll. */}
      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 lg:-mb-8 lg:h-[calc(100dvh-5.75rem)] lg:min-h-[36rem]">
        {items.length === 0 ? (
          <EmptyState title="Cơ sở chưa có sân con nào" />
        ) : selected ? (
          <div className="grid grid-cols-1 gap-6 lg:h-full lg:grid-cols-7 lg:grid-rows-[minmax(0,1fr)]">
            <div ref={workAreaRef} className="min-w-0 scroll-mt-16 lg:col-span-5 lg:flex lg:min-h-0 lg:flex-col lg:overflow-y-auto">
              <CourtTimelineBoard
                className="lg:min-h-[24rem] lg:flex-1"
                items={items}
                venueName={data.court.name}
                selectedSurfaceId={selected.surface.id}
                onSelectSurface={setSelectedSurfaceId}
                bookingDate={walkInDate}
                onDateChange={setWalkInDate}
                walkIn={walkIn}
                liveBooking={canBookAdvance ? liveBooking : null}
                liveServices={liveServices}
                serviceTarget={activeServiceTarget}
                onServiceTargetChange={setServiceTarget}
              />
              {/* Sub-court paused mid-session: it takes no bookings, but the guest on it can still be served. */}
              {!canBookAdvance && liveBooking ? (
                <div className="mt-4">
                  <LiveBookingServicePanel bookingId={liveBooking.id} onChanged={refresh} />
                </div>
              ) : null}
            </div>

                {/* The booking form sits left of the schedule on wide screens; on a phone it stays below it. */}
                <div className="min-w-0 space-y-2.5 lg:order-first lg:col-span-2 lg:flex lg:min-h-0 lg:flex-col lg:overflow-y-auto lg:pr-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar]:w-1.5">
                  {servingLiveGuest ? (
                    <LiveBookingBillSummary
                      bookingId={liveBooking!.id}
                      services={liveServices}
                      onDone={() => walkIn.setShowServices(false)}
                    />
                  ) : (
                    <>
                      {/* Which sub-court the actions below are for: the one picked in the timeline, large so staff see at
                          a glance which court they are booking or serving. */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748b]">Sân đang chọn</p>
                          <h2 className="truncate text-[22px] font-extrabold leading-[1.3] text-[#064e3b]">
                            {surfaceShortName(selected.surface.name, data.court.name)}
                          </h2>
                        </div>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${statusMeta[selected.status].className}`}>
                          {statusMeta[selected.status].label}
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {selected.status === "OVERDUE" && selected.latestEndedBooking ? (
                          <div className="rounded-xl border border-red-100 bg-red-50/70 p-2.5">
                            <p className="text-xs font-bold uppercase tracking-wide text-red-700">Khách đã quá giờ</p>
                            <p className="mt-1 font-black text-slate-800">{selected.latestEndedBooking.customerName}</p>
                            {selected.latestEndedBooking.customerPhone ? (
                              <p className="flex items-center gap-1 text-sm text-slate-600">
                                <PhoneCall className="h-3.5 w-3.5 shrink-0" />
                                {selected.latestEndedBooking.customerPhone}
                              </p>
                            ) : null}
                            <p className="mt-1 text-sm text-slate-600">
                              Lịch cũ: {selected.latestEndedBooking.startTime} - {selected.latestEndedBooking.endTime}
                            </p>
                          </div>
                        ) : selected.currentBooking ? (
                          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-2.5">
                            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Khách đang chơi</p>
                            <p className="mt-1 font-black text-slate-800">{selected.currentBooking.customerName}</p>
                            {selected.currentBooking.customerPhone ? (
                              <p className="flex items-center gap-1 text-sm text-slate-600">
                                <PhoneCall className="h-3.5 w-3.5 shrink-0" />
                                {selected.currentBooking.customerPhone}
                              </p>
                            ) : null}
                            <p className="mt-1 text-sm text-slate-600">
                              {selected.currentBooking.startTime} - {selected.currentBooking.endTime}
                              {selected.minutesLeft != null && selected.minutesLeft > 0 ? <span className="ml-1 font-semibold text-amber-700">(còn {selected.minutesLeft} phút)</span> : null}
                            </p>
                          </div>
                        ) : selected.nextBooking ? (
                          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-2.5">
                            <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Khách sắp nhận sân</p>
                            <p className="mt-1 font-black text-slate-800">{selected.nextBooking.customerName}</p>
                            <p className="text-sm text-slate-600">
                              {selected.nextBooking.startTime} - {selected.nextBooking.endTime}
                            </p>
                          </div>
                        ) : selected.surface.status !== "ACTIVE" ? (
                          <p className="text-sm font-semibold text-slate-500">Sân đang tạm ngưng hoạt động.</p>
                        ) : null}
                      </div>

                      <div className="space-y-2.5 lg:flex lg:flex-1 lg:flex-col">
                        {selected.status === "OVERDUE" && selected.latestEndedBooking ? (
                          <>
                            <div>
                              <p className="mb-2 text-sm font-black text-slate-500">Khách muốn chơi tiếp</p>
                              <div className="flex flex-wrap gap-2">
                                {extendOptions.map((minutes) => (
                                  <Button
                                    key={minutes}
                                    variant="secondary"
                                    disabled={extendBooking.isPending || extensionBlocked(minutes)}
                                    title={extensionBlocked(minutes) ? "Vượt giờ đóng cửa" : undefined}
                                    onClick={() => extendBooking.mutate({ id: selected.latestEndedBooking!.id, minutes })}
                                  >
                                    <TimerReset className="h-4 w-4" />
                                    {extensionLabel(minutes)}
                                  </Button>
                                ))}
                              </div>
                            </div>
                            <Button className="w-full" variant="danger" disabled={completeOverdue.isPending} onClick={() => completeOverdue.mutate(selected.latestEndedBooking!.id)}>
                              <LogOut className="h-4 w-4" />
                              {completeOverdue.isPending ? "Đang xác nhận..." : "Xác nhận trả sân"}
                            </Button>
                          </>
                        ) : selected.currentBooking?.bookingStatus === "COMPLETED" ? (
                          <p className="rounded-xl bg-emerald-50 p-2.5 text-sm font-semibold text-emerald-800">
                            Đơn đã thanh toán xong ở Thu ngân; khách vẫn trong giờ đã đặt.
                          </p>
                        ) : selected.currentBooking ? (
                          <>
                            {canBookAdvance ? (
                              <Button
                                className="w-full"
                                onClick={() => {
                                  setServiceTarget("live");
                                  walkIn.setShowServices(true);
                                }}
                              >
                                <ShoppingBag className="h-4 w-4" />
                                Thêm dịch vụ
                              </Button>
                            ) : null}
                            {!selected.currentBooking.checkedInAt ? (
                              <p className="text-xs font-semibold text-amber-700">
                                Chưa check-in — hệ thống sẽ tự check-in khi thêm dịch vụ trong giờ phục vụ.
                              </p>
                            ) : null}
                            <div>
                              <p className="mb-2 text-sm font-black text-slate-500">Gia hạn thời gian chơi</p>
                              <div className="flex flex-wrap gap-2">
                                {extendOptions.map((minutes) => (
                                  <Button
                                    key={minutes}
                                    variant="secondary"
                                    disabled={extendBooking.isPending || extensionBlocked(minutes)}
                                    title={extensionBlocked(minutes) ? "Vượt giờ đóng cửa" : undefined}
                                    onClick={() => extendBooking.mutate({ id: selected.currentBooking!.id, minutes })}
                                  >
                                    <TimerReset className="h-4 w-4" />
                                    {extensionLabel(minutes)}
                                  </Button>
                                ))}
                              </div>
                              {!selected.canExtend && (
                                <p className="mt-2 text-sm font-semibold text-amber-700">
                                  Sân đã có lịch đặt ngay sau đó. Nếu gia hạn bị trùng lịch, bạn sẽ được chọn chuyển khách sang sân trống khác.
                                </p>
                              )}
                            </div>
                            <Button
                              className="w-full"
                              variant="secondary"
                              disabled={earlyCheckOut.isPending}
                              onClick={() => setCheckingOut({ id: selected.currentBooking!.id, customerName: selected.currentBooking!.customerName })}
                            >
                              <LogOut className="h-4 w-4" />
                              {earlyCheckOut.isPending ? "Đang check-out..." : "Check-out"}
                            </Button>
                          </>
                        ) : selected.nextBooking ? (
                          <div className="space-y-1.5">
                            <Button
                              className="w-full"
                              variant="secondary"
                              disabled={earlyCheckIn.isPending || earlyQuote?.allowed === false}
                              onClick={() => earlyCheckIn.mutate(selected.nextBooking!.id)}
                            >
                              <LogIn className="h-4 w-4" />
                              {earlyCheckIn.isPending ? "Đang check-in..." : "Check-in sớm"}
                            </Button>
                            {earlyCheckInHint ? (
                              <p className={`text-xs font-semibold ${earlyQuote?.allowed === false ? "text-amber-700" : "text-slate-600"}`}>{earlyCheckInHint}</p>
                            ) : null}
                          </div>
                        ) : null}

                        {canBookAdvance ? (
                          <div className="space-y-2 lg:flex lg:flex-1 lg:flex-col">
                            <p className="text-sm font-black text-slate-500">Đặt sân cho khách</p>
                            <WalkInDetailsFields walkIn={walkIn} fill />
                          </div>
                        ) : null}

                        {selected.surface.status === "ACTIVE" ? (
                          <Button
                            className="w-full"
                            variant="danger"
                            disabled={toggleStatus.isPending}
                            onClick={() => setPausing({ id: selected.surface.id, name: selected.surface.name })}
                          >
                            Tạm ngưng sân
                          </Button>
                        ) : selected.surface.pausedByRole === "RECIPIENT" ? (
                          <Button
                            className="w-full"
                            variant="secondary"
                            disabled={toggleStatus.isPending}
                            onClick={() => toggleStatus.mutate({ id: selected.surface.id, status: "ACTIVE" })}
                          >
                            Kích hoạt lại
                          </Button>
                        ) : (
                          <p className="rounded-xl bg-slate-100 p-2.5 text-xs font-semibold text-slate-600">
                            Đối tác đã tạm ngưng sân con này; chỉ đối tác mở lại được.
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
          </div>
        ) : (
          <p className="py-6 text-center text-sm font-semibold text-slate-500">Chọn một sân con để xem chi tiết.</p>
        )}
      </section>

      <Modal isOpen={extendConflict != null} onClose={() => setExtendConflict(null)} title="Sân đã có lịch, chọn sân trống để chuyển khách">
        {extendConflict ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Ngay sau giờ của khách, sân này đã có khách đặt hoặc đang khoá. Chọn một sân trống để chuyển khách sang (khách chơi ở sân mới từ
              bây giờ) và gia hạn thêm {extendConflict.minutes} phút.
            </p>
            <div className="flex flex-col gap-2">
              {extendConflict.surfaces.map((surface) => (
                <Button
                  key={surface.id}
                  variant="secondary"
                  disabled={extendBooking.isPending}
                  onClick={() =>
                    extendBooking.mutate({
                      id: extendConflict.bookingId,
                      minutes: extendConflict.minutes,
                      targetSurfaceId: surface.id
                    })
                  }
                >
                  {surface.name}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmModal
        open={Boolean(checkingOut)}
        title="Check-out cho khách?"
        message={`${checkingOut?.customerName ?? "Khách"} rời sân sớm: đơn kết thúc ngay và phần giờ còn lại được trả lại. Đơn còn nợ tiền sẽ chuyển sang Thu ngân để thu trước.`}
        onCancel={() => setCheckingOut(null)}
        onConfirm={() => checkingOut && earlyCheckOut.mutate(checkingOut.id)}
      />
      <AffectedBookingsModal
        open={Boolean(pausing)}
        title="Tạm ngưng sân con"
        description={`Tạm ngưng ${pausing?.name ?? "sân con"} để dừng nhận đặt mới? Các đơn đã đặt vẫn được giữ và khách được báo; đơn nào không phục vụ được hãy huỷ ở trang Đơn đặt sân.`}
        bookings={affected.data}
        loading={affected.isLoading}
        confirmLabel="Tạm ngưng"
        danger
        pending={toggleStatus.isPending}
        onClose={() => setPausing(null)}
        onConfirm={() => pausing && toggleStatus.mutate({ id: pausing.id, status: "INACTIVE" })}
      />
    </div>
  );
}
