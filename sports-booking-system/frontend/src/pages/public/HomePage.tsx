import { HeroSection } from "./home/HeroSection";
import { QuickBookingSection } from "./home/QuickBookingSection";
import { NearbyCourtsSection } from "./home/NearbyCourtsSection";
import { TrendingCourtsSection } from "./home/TrendingCourtsSection";
import { PromotionSection } from "./home/PromotionSection";
import { LiveBookingFeedSection } from "./home/LiveBookingFeedSection";
import { MapSection } from "./home/MapSection";
import { TournamentSection } from "./home/TournamentSection";
import { FindTeammateSection } from "./home/FindTeammateSection";
import { TopPartnerSection } from "./home/TopPartnerSection";
import { ReviewSection } from "./home/ReviewSection";
import { AchievementSection } from "./home/AchievementSection";
import { WhyChooseUsSection } from "./home/WhyChooseUsSection";
import { PartnerLandingSection } from "./home/PartnerLandingSection";
import { BlogSection } from "./home/BlogSection";
import { FAQSection } from "./home/FAQSection";
import { AppSection } from "./home/AppSection";
import { GamificationSection } from "./home/GamificationSection";
import { AIRecommendationSection } from "./home/AIRecommendationSection";

export function HomePage() {
  return (
    <div className="bg-white">
      <HeroSection />
      <QuickBookingSection />
      <NearbyCourtsSection />
      <TrendingCourtsSection />
      <PromotionSection />
      <LiveBookingFeedSection />
      <MapSection />
      <TournamentSection />
      <FindTeammateSection />
      <TopPartnerSection />
      <ReviewSection />
      <AchievementSection />
      <WhyChooseUsSection />
      <GamificationSection />
      <AIRecommendationSection />
      <PartnerLandingSection />
      <BlogSection />
      <FAQSection />
      <AppSection />
    </div>
  );
}
