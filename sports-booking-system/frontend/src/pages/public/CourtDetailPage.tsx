import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutGrid } from "lucide-react";
import type { WeeklyScheduleSlot } from "../../types/api";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/States";
import { useCourt } from "../../features/courts/hooks/useCourts";
import { useUserLocation } from "../../features/courts/hooks/useUserLocation";
import { useLanguage } from "../../lib/i18n";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { formatYmd, startOfWeek, WeeklyCalendarSection } from "../../features/bookings/components/BookingCalendar";
import {
  usePrefetchAdjacentWeeks,
  useWeeklySchedule
} from "../../features/bookings/hooks/useBookingSchedule";
import { getSocket } from "../../lib/socket";
import { HeroGallery } from "./detail/HeroGallery";
import { StickyBookingBar } from "./detail/StickyBookingBar";
import { CourtInfo } from "./detail/CourtInfo";
import { QuickStats } from "./detail/QuickStats";
import { PricingSection } from "./detail/PricingSection";
import { AmenitiesSection } from "./detail/AmenitiesSection";
import { PartnerSection } from "./detail/PartnerSection";
import { PolicySection } from "./detail/PolicySection";
import { ReviewSection } from "./detail/ReviewSection";
import { ReviewAnalytics } from "./detail/ReviewAnalytics";
import { NearbyCourts } from "./detail/SimilarCourts";
import { InteractiveMap } from "./detail/InteractiveMap";
import { CourtSectionNav } from "./detail/CourtSectionNav";
import { DetailSection } from "./detail/detailUtils";
import { CourtDetailBookingSidePanel } from "./detail/CourtDetailBookingSidePanel";
import { detailImages } from "./detail/detailData";
import { useBookingContext } from "../../context/BookingContext";

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function timeText(value?: string) {
  if (!value) return "";
  return value.includes("T") ? value.slice(11, 16) : value.slice(0, 5);
}

export function CourtDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const court = useCourt(id);
  const { language } = useLanguage();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { location: userLoc } = useUserLocation({ autoRequest: true });
  const [selectedSurfaceId, setSelectedSurfaceId] = useState<string | null>(null);

  // ── Global booking context ──────────────────────────────────────────────────
  // This is the single source of truth for all booking state.
  // Slots, week navigation, and court info are shared across the entire app.
  const {
    state: bookingState,
    toggleSlot,
    removeSlot,
    clearSlots,
    setWeekStart: ctxSetWeekStart,
    setFocusedDate: ctxSetFocusedDate,
    goToNextWeek,
    goToPrevWeek,
    goToToday,
    setCourt: ctxSetCourt,
    totalSlots
  } = useBookingContext();

  // ── Initialize week from URL ────────────────────────────────────────────────
  const initialWeekFromUrl = searchParams.get("week") ?? undefined;
  const [weekStartDate, setWeekStartDate] = [bookingState.weekStart, ctxSetWeekStart];
  const weekStart = formatYmd(weekStartDate);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set("week", weekStart);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }, [weekStart]);

  // ── Sync court info to global context ───────────────────────────────────────
  useEffect(() => {
    if (court.data?.id && court.data?.name) {
      ctxSetCourt(court.data.id, court.data.name);
    }
  }, [court.data?.id, court.data?.name, ctxSetCourt]);

  // Reset draft selection when navigating away from this court
  useEffect(() => {
    return () => {
      clearSlots();
    };
  }, [clearSlots]);

  const surfaces = court.data?.surfaces;

  const activeSurface = useMemo(() => {
    if (!court.data?.surfaces?.length) return null;
    return court.data.surfaces.find((s: any) => s.id === selectedSurfaceId) || court.data.surfaces[0];
  }, [court.data?.surfaces, selectedSurfaceId]);

  const activeSurfaceId = activeSurface?.id;

  const schedule = useWeeklySchedule(id, weekStart, activeSurfaceId);
  usePrefetchAdjacentWeeks(id, weekStart, activeSurfaceId);

  const handleToggleSlot = useCallback(
    (slot: WeeklyScheduleSlot) => {
      const enrichedSlot: WeeklyScheduleSlot = {
        ...slot,
        courtSurfaceId: slot.courtSurfaceId || activeSurfaceId || null,
        courtSurfaceName: slot.courtSurfaceName || activeSurface?.name || court.data?.name || ""
      };
      toggleSlot(enrichedSlot);
    },
    [activeSurfaceId, activeSurface?.name, court.data?.name, toggleSlot]
  );

  // ── Realtime invalidation ──────────────────────────────────────────────────
  useEffect(() => {
    if (!id || !token) return;
    const socket = getSocket(token);
    socket.emit("court:subscribe", id);
    const refresh = () =>
      queryClient.invalidateQueries({ queryKey: ["weekly-schedule", id] });
    socket.on("court:availability:updated", refresh);
    socket.on("booking:created", refresh);
    socket.on("booking:cancelled", refresh);
    socket.on("booking:confirmed", refresh);
    return () => {
      socket.emit("court:unsubscribe", id);
      socket.off("court:availability:updated", refresh);
      socket.off("booking:created", refresh);
      socket.off("booking:cancelled", refresh);
      socket.off("booking:confirmed", refresh);
    };
  }, [id, queryClient, token]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const distanceText = useMemo(() => {
    const data = court.data;
    if (userLoc && data?.latitude && data?.longitude) {
      const d = getDistanceKm(
        userLoc.latitude,
        userLoc.longitude,
        Number(data.latitude),
        Number(data.longitude)
      );
      return `${d.toFixed(1)} km`;
    }
    if (data?.distanceKm != null) {
      return `${Number(data.distanceKm).toFixed(1)} km`;
    }
    return null;
  }, [userLoc, court.data]);

  const view = useMemo(() => {
    const data = court.data;
    const images = data?.images?.length ? data.images.map((item) => item.imageUrl) : detailImages;
    return {
      id: data?.id ?? id ?? "fallback",
      name: data?.name ?? "Sân thể thao",
      category: data?.category?.name ?? "Sân thể thao",
      address: [data?.address, data?.ward, data?.district, data?.city].filter(Boolean).join(", ") || "Chưa cập nhật địa chỉ",
      latitude: data?.latitude,
      longitude: data?.longitude,
      openingHours: `${timeText(data?.openingTime) || "05:00"} - ${timeText(data?.closingTime) || "23:00"}`,
      price: data?.minPrice ?? 0,
      rating: data?.averageRating ?? 0,
      reviewCount: data?.reviewCount ?? data?.reviews?.length ?? 0,
      bookingCount: data?.reviewCount ?? data?.reviews?.length ?? 0,
      images
    };
  }, [court.data, id]);

  const selectedDate = formatYmd(bookingState.focusedDate);

  if (court.isLoading) return <div className="px-5 py-16"><LoadingState /></div>;
  if (court.isError) return <div className="px-5 py-16"><ErrorState message={court.error.message} /></div>;
  if (!court.data && !id) return <div className="px-5 py-16"><EmptyState /></div>;

  return (
    <div className="bg-[#f5f7fb] pb-16 text-[#0b1220]">
      <StickyBookingBar
        courtId={view.id}
        price={view.price}
        rating={view.rating}
        selectedDate={selectedDate}
        selectedSlots={bookingState.selectedSlots}
      />
      <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-6">
        <HeroGallery images={view.images} />
        <CourtInfo
          name={view.name}
          category={view.category}
          address={view.address}
          openingHours={view.openingHours}
          rating={view.rating}
          reviewCount={view.reviewCount}
          bookingCount={view.bookingCount}
          distance={distanceText}
        />

        {court.data?.surfaces && court.data.surfaces.length > 0 && (
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-black text-[#0b1220] flex items-center gap-2">
                  <LayoutGrid className="h-5 w-5 text-[#02712a]" />
                  Danh Sách Sân Con Trực Thuộc ({court.data.surfaces.length} Sân Con)
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  Quý khách có thể chọn cụ thể 1 trong các sân con bên dưới để đặt lịch thi đấu
                </p>
              </div>

            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {court.data.surfaces.map((sf: any) => {
                const isSelected = selectedSurfaceId === sf.id;
                return (
                  <button
                    key={sf.id}
                    type="button"
                    onClick={() => setSelectedSurfaceId(isSelected ? null : sf.id)}
                    className={`rounded-2xl border p-4 text-left transition flex items-start justify-between ${isSelected
                        ? "border-[#02712a] bg-emerald-50/70 shadow-md ring-2 ring-[#02712a]/30"
                        : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50"
                      }`}
                  >
                    <div>
                      <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-black text-[#02712a]">
                        Mã: {sf.code}
                      </span>
                      <h4 className="mt-1 font-black text-slate-900 text-sm">{sf.name}</h4>
                      <p className="text-xs text-slate-500 font-semibold mt-1">{sf.surface || "Mặt sân tiêu chuẩn"} • {sf.capacity || "7 người"}</p>
                    </div>
                    <span className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition ${isSelected ? "border-[#02712a] bg-[#02712a]" : "border-slate-300"}`}>
                      {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="sticky top-20 z-30 xl:hidden">
          <CourtSectionNav />
        </div>

        <div className="grid gap-6 xl:grid-cols-[210px_1fr]">
          <aside className="hidden xl:block">
            <div className="sticky top-24">
              <CourtSectionNav />
            </div>
          </aside>

          <main className="space-y-6">
            <section id="tong-quan" className="scroll-mt-28">
              <QuickStats
                price={view.price ? `${view.price.toLocaleString("vi-VN")}đ/giờ` : "Chưa cập nhật"}
                rating={view.rating}
              />
            </section>
            <section id="ban-do" className="scroll-mt-28">
              <InteractiveMap address={view.address} latitude={view.latitude} longitude={view.longitude} />
            </section>
            <section id="lich-san" className="scroll-mt-28">
              <DetailSection
                title="Lịch đặt sân trong tuần"
                description="Chọn một hoặc nhiều khung giờ còn trống. Giá, dynamic pricing và demand prediction được lấy trực tiếp từ backend."
              >
                {/* Sub-Court (Sân con) Selector */}
                {surfaces && surfaces.length > 0 && (
                  <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-900 flex items-center gap-1.5 mr-2">
                        <LayoutGrid className="h-4 w-4 text-emerald-600" />
                        Chọn Sân Con:
                      </span>
                      {surfaces.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelectedSurfaceId(s.id)}
                          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-black transition border ${(selectedSurfaceId ?? surfaces[0]?.id) === s.id
                              ? "bg-[#02712a] text-white border-[#02712a] shadow-md scale-105"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-emerald-100/60"
                            }`}
                        >
                          <span className="h-2 w-2 rounded-full bg-emerald-400" />
                          {s.name} ({s.code})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <WeeklyCalendarSection
                  response={schedule.data}
                  isLoading={schedule.isLoading}
                  isError={schedule.isError}
                  error={schedule.error as Error | null}
                  onRetry={() => schedule.refetch()}
                  weekStart={weekStartDate}
                  onWeekStartChange={ctxSetWeekStart}
                  focusedDate={bookingState.focusedDate}
                  onFocusedDateChange={ctxSetFocusedDate}
                  selected={bookingState.selectedSlots}
                  onSelectedChange={(slots) => {
                    // slots from WeeklyCalendarSection are only the NEW slot being toggled
                    // We use toggleSlot from context instead
                    // This callback is only used internally by the calendar
                  }}
                  onToggleSlot={handleToggleSlot}
                  language={language}
                  forceDayOnCompact
                  rightSlot={
                    <CourtDetailBookingSidePanel
                      courtId={view.id}
                      selectedDate={selectedDate}
                      selectedSlots={bookingState.selectedSlots}
                      onRemoveSlot={removeSlot}
                      onClearSlots={clearSlots}
                    />
                  }
                />
              </DetailSection>
            </section>
            <section id="bang-gia" className="scroll-mt-28">
              <PricingSection prices={court.data?.prices ?? []} />
            </section>
            <section id="tien-ich" className="scroll-mt-28">
              <AmenitiesSection amenities={court.data?.amenities ?? []} />
            </section>
            <section id="doi-tac" className="scroll-mt-28">
              <PartnerSection partner={court.data?.partner} />
            </section>
            <section id="chinh-sach" className="scroll-mt-28">
              <PolicySection />
            </section>
            <section id="danh-gia" className="scroll-mt-28">
              <div className="space-y-6">
                <ReviewAnalytics breakdown={court.data?.ratingBreakdown ?? []} />
                <ReviewSection courtId={view.id} reviews={court.data?.reviews ?? []} />
              </div>
            </section>
            <section id="san-gan-day" className="scroll-mt-28">
              <NearbyCourts
                courts={court.data?.nearbyCourts ?? []}
                description="Danh sách lấy từ API chi tiết sân, ưu tiên các sân công khai cùng quận và cùng thành phố."
              />
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
