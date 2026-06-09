import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/States";
import { useCourt } from "../../features/courts/hooks/useCourts";
import { HeroGallery } from "./detail/HeroGallery";
import { StickyBookingBar } from "./detail/StickyBookingBar";
import { CourtInfo } from "./detail/CourtInfo";
import { QuickStats } from "./detail/QuickStats";
import { AvailabilityCalendar } from "./detail/AvailabilityCalendar";
import { PricingSection } from "./detail/PricingSection";
import { HeatmapSection } from "./detail/HeatmapSection";
import { AmenitiesSection } from "./detail/AmenitiesSection";
import { ServicesSection } from "./detail/ServicesSection";
import { PartnerSection } from "./detail/PartnerSection";
import { PolicySection } from "./detail/PolicySection";
import { ReviewSection } from "./detail/ReviewSection";
import { ReviewAnalytics } from "./detail/ReviewAnalytics";
import { NearbyCourts, SimilarCourts } from "./detail/SimilarCourts";
import { TournamentSection } from "./detail/TournamentSection";
import { CommunitySection } from "./detail/CommunitySection";
import { LiveActivity } from "./detail/LiveActivity";
import { FAQSection } from "./detail/FAQSection";
import { StickyBookingPanel } from "./detail/StickyBookingPanel";
import { InteractiveMap } from "./detail/InteractiveMap";
import { AIRecommendation } from "./detail/AIRecommendation";
import { GamificationSection } from "./detail/GamificationSection";
import { detailImages } from "./detail/detailData";

function timeText(value?: string) {
  if (!value) return "";
  return value.includes("T") ? value.slice(11, 16) : value.slice(0, 5);
}

export function CourtDetailPage() {
  const { id } = useParams();
  const court = useCourt(id);
  const [selectedSlot, setSelectedSlot] = useState("18:00");

  const view = useMemo(() => {
    const data = court.data;
    const images = data?.images?.length ? data.images.map((item) => item.imageUrl) : detailImages;
    return {
      id: data?.id ?? id ?? "fallback",
      name: data?.name ?? "Panda Badminton Premium",
      category: data?.category?.name ?? "Cầu lông",
      address: [data?.address, data?.ward, data?.district, data?.city].filter(Boolean).join(", ") || "65A D. Lò Tư, Bình Tân, TP.HCM",
      openingHours: `${timeText(data?.openingTime) || "05:00"} - ${timeText(data?.closingTime) || "23:00"}`,
      price: data?.minPrice ?? 120000,
      rating: data?.averageRating ?? 4.9,
      reviewCount: data?.reviewCount ?? data?.reviews?.length ?? 0,
      bookingCount: 21840,
      images
    };
  }, [court.data, id]);

  if (court.isLoading) return <div className="px-5 py-16"><LoadingState /></div>;
  if (court.isError) return <div className="px-5 py-16"><ErrorState message={court.error.message} /></div>;
  if (!court.data && !id) return <div className="px-5 py-16"><EmptyState /></div>;

  return (
    <div className="bg-[#f5f7fb] pb-16 text-[#0b1220]">
      <StickyBookingBar courtId={view.id} price={view.price} rating={view.rating} selectedSlot={selectedSlot} />
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
            <QuickStats price={`${view.price.toLocaleString("vi-VN")}đ/giờ`} rating={view.rating} />
            <InteractiveMap address={view.address} />
            <AvailabilityCalendar selectedSlot={selectedSlot} onSelectSlot={setSelectedSlot} />
            <PricingSection />
            <HeatmapSection />
            <AmenitiesSection />
            <ServicesSection />
            <PartnerSection />
            <PolicySection />
            <ReviewAnalytics breakdown={court.data?.ratingBreakdown ?? []} />
            <ReviewSection reviews={court.data?.reviews ?? []} />
            <AIRecommendation />
            <SimilarCourts />
            <NearbyCourts />
            <TournamentSection />
            <CommunitySection />
            <LiveActivity />
            <GamificationSection />
            <FAQSection />
          </main>
          <div className="hidden lg:block">
            <StickyBookingPanel courtId={view.id} price={view.price} selectedSlot={selectedSlot} />
          </div>
        </div>
      </div>
    </div>
  );
}
