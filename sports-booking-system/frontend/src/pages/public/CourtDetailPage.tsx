import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
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
import type { WeeklyScheduleSlot } from "../../types/api";
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

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
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
  const court = useCourt(id);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [weekStartDate, setWeekStartDate] = useState<Date>(() => startOfWeek(today));
  const [focusedDate, setFocusedDate] = useState<Date>(() => new Date(`${today}T00:00:00`));
  const [selected, setSelected] = useState<WeeklyScheduleSlot[]>([]);
  const { language } = useLanguage();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { location: userLoc } = useUserLocation({ autoRequest: true });

  const weekStart = formatYmd(weekStartDate);
  const schedule = useWeeklySchedule(id, weekStart);

  usePrefetchAdjacentWeeks(id, weekStart);

  // Realtime: invalidate weekly-schedule cache when bookings change.
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

  const selectedDate = formatYmd(focusedDate);

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
        selectedSlots={selected}
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
                <WeeklyCalendarSection
                  response={schedule.data}
                  isLoading={schedule.isLoading}
                  isError={schedule.isError}
                  error={schedule.error as Error | null}
                  onRetry={() => schedule.refetch()}
                  weekStart={weekStartDate}
                  onWeekStartChange={(next) => {
                    setWeekStartDate(next);
                    setSelected([]);
                  }}
                  focusedDate={focusedDate}
                  onFocusedDateChange={setFocusedDate}
                  selected={selected}
                  onSelectedChange={setSelected}
                  language={language}
                  forceDayOnCompact
                  rightSlot={
                    <CourtDetailBookingSidePanel
                      courtId={view.id}
                      selectedDate={selectedDate}
                      selectedSlots={selected}
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