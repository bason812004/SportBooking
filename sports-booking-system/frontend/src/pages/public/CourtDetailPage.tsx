import { useMemo, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/States";
import type { AvailabilitySlot } from "../../features/courts/api/courtApi";
import { useCourt, useCourtAvailability } from "../../features/courts/hooks/useCourts";
import { useUserLocation } from "../../features/courts/hooks/useUserLocation";
import { HeroGallery } from "./detail/HeroGallery";
import { StickyBookingBar } from "./detail/StickyBookingBar";
import { CourtInfo } from "./detail/CourtInfo";
import { QuickStats } from "./detail/QuickStats";
import { AvailabilityCalendar } from "./detail/AvailabilityCalendar";
import { PricingSection } from "./detail/PricingSection";
import { AmenitiesSection } from "./detail/AmenitiesSection";
import { PartnerSection } from "./detail/PartnerSection";
import { PolicySection } from "./detail/PolicySection";
import { ReviewSection } from "./detail/ReviewSection";
import { ReviewAnalytics } from "./detail/ReviewAnalytics";
import { NearbyCourts } from "./detail/SimilarCourts";
import { StickyBookingPanel } from "./detail/StickyBookingPanel";
import { InteractiveMap } from "./detail/InteractiveMap";
import { CourtSectionNav } from "./detail/CourtSectionNav";
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

function SectionAnchor({ id, children }: { id: string; children: ReactNode }) {
  return <section id={id} className="scroll-mt-28">{children}</section>;
}

export function CourtDetailPage() {
  const { id } = useParams();
  const court = useCourt(id);
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedSlots, setSelectedSlots] = useState<AvailabilitySlot[]>([]);
  const availability = useCourtAvailability(id, selectedDate);
  const { location: userLoc } = useUserLocation({ autoRequest: true });

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

  function toggleSlot(slot: AvailabilitySlot) {
    setSelectedSlots((current) => {
      const exists = current.some((item) => item.startTime === slot.startTime && item.endTime === slot.endTime);
      if (exists) return current.filter((item) => item.startTime !== slot.startTime || item.endTime !== slot.endTime);
      return [...current, slot].sort((left, right) => left.startTime.localeCompare(right.startTime));
    });
  }

  function handleDateChange(date: string) {
    setSelectedDate(date);
    setSelectedSlots([]);
  }

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

  if (court.isLoading) return <div className="px-5 py-16"><LoadingState /></div>;
  if (court.isError) return <div className="px-5 py-16"><ErrorState message={court.error.message} /></div>;
  if (!court.data && !id) return <div className="px-5 py-16"><EmptyState /></div>;

  return (
    <div className="bg-[#f5f7fb] pb-16 text-[#0b1220]">
      <StickyBookingBar courtId={view.id} price={view.price} rating={view.rating} selectedDate={selectedDate} selectedSlots={selectedSlots} />
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

        <div className="grid gap-6 lg:grid-cols-[1fr_360px] xl:grid-cols-[210px_1fr_360px]">
          <aside className="hidden xl:block">
            <div className="sticky top-24">
              <CourtSectionNav />
            </div>
          </aside>

          <main className="space-y-6">
            <SectionAnchor id="tong-quan">
              <QuickStats price={view.price ? `${view.price.toLocaleString("vi-VN")}đ/giờ` : "Chưa cập nhật"} rating={view.rating} />
            </SectionAnchor>
            <SectionAnchor id="ban-do">
              <InteractiveMap address={view.address} latitude={view.latitude} longitude={view.longitude} />
            </SectionAnchor>
            <SectionAnchor id="lich-san">
              <AvailabilityCalendar
                date={selectedDate}
                onDateChange={handleDateChange}
                slots={availability.data?.slots ?? []}
                selectedSlots={selectedSlots}
                loading={availability.isLoading}
                onToggleSlot={toggleSlot}
              />
            </SectionAnchor>
            <SectionAnchor id="bang-gia">
              <PricingSection prices={court.data?.prices ?? []} />
            </SectionAnchor>
            <SectionAnchor id="tien-ich">
              <AmenitiesSection amenities={court.data?.amenities ?? []} />
            </SectionAnchor>
            <SectionAnchor id="doi-tac">
              <PartnerSection partner={court.data?.partner} />
            </SectionAnchor>
            <SectionAnchor id="chinh-sach">
              <PolicySection />
            </SectionAnchor>
            <SectionAnchor id="danh-gia">
              <div className="space-y-6">
                <ReviewAnalytics breakdown={court.data?.ratingBreakdown ?? []} />
                <ReviewSection courtId={view.id} reviews={court.data?.reviews ?? []} />
              </div>
            </SectionAnchor>
            <SectionAnchor id="san-gan-day">
              <NearbyCourts
                courts={court.data?.nearbyCourts ?? []}
                description="Danh sách lấy từ API chi tiết sân, ưu tiên các sân công khai cùng quận và cùng thành phố."
              />
            </SectionAnchor>
          </main>

          <div className="hidden lg:block">
            <StickyBookingPanel courtId={view.id} price={view.price} selectedDate={selectedDate} selectedSlots={selectedSlots} />
          </div>
        </div>
      </div>
    </div>
  );
}
