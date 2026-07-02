import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/States";
import type { AvailabilitySlot } from "../../features/courts/api/courtApi";
import { useCourt, useCourtAvailability } from "../../features/courts/hooks/useCourts";
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
import { detailImages } from "./detail/detailData";

function timeText(value?: string) {
  if (!value) return "";
  return value.includes("T") ? value.slice(11, 16) : value.slice(0, 5);
}

export function CourtDetailPage() {
  const { id } = useParams();
  const court = useCourt(id);
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedSlots, setSelectedSlots] = useState<AvailabilitySlot[]>([]);
  const availability = useCourtAvailability(id, selectedDate);

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
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <HeroGallery images={view.images} />
        <CourtInfo
          name={view.name}
          category={view.category}
          address={view.address}
          openingHours={view.openingHours}
          rating={view.rating}
          reviewCount={view.reviewCount}
          bookingCount={view.bookingCount}
        />

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <main className="space-y-6">
            <QuickStats price={view.price ? `${view.price.toLocaleString("vi-VN")}đ/giờ` : "Chưa cập nhật"} rating={view.rating} />
            <InteractiveMap address={view.address} latitude={view.latitude} longitude={view.longitude} />
            <AvailabilityCalendar
              date={selectedDate}
              onDateChange={handleDateChange}
              slots={availability.data?.slots ?? []}
              selectedSlots={selectedSlots}
              loading={availability.isLoading}
              onToggleSlot={toggleSlot}
            />
            <PricingSection prices={court.data?.prices ?? []} />
            <AmenitiesSection amenities={court.data?.amenities ?? []} />
            <PartnerSection partner={court.data?.partner} />
            <PolicySection />
            <ReviewAnalytics breakdown={court.data?.ratingBreakdown ?? []} />
            <ReviewSection reviews={court.data?.reviews ?? []} />
            <NearbyCourts
              courts={court.data?.nearbyCourts ?? []}
              description="Danh sách này được lấy từ API chi tiết sân, dựa trên các sân công khai cùng khu vực trong cơ sở dữ liệu."
            />
          </main>
          <div className="hidden lg:block">
            <StickyBookingPanel courtId={view.id} price={view.price} selectedDate={selectedDate} selectedSlots={selectedSlots} />
          </div>
        </div>
      </div>
    </div>
  );
}
