import { Navigate, Route, Routes } from "react-router-dom";
import { PublicLayout } from "../components/layout/PublicLayout";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { ProtectedRoute } from "./ProtectedRoute";
import { HomePage } from "../pages/public/HomePage";
import { CourtsPage } from "../pages/public/CourtsPage";
import { CourtDetailPage } from "../pages/public/CourtDetailPage";
import { PartnersLandingPage } from "../pages/public/PartnersLandingPage";
import { VouchersPage } from "../pages/public/VouchersPage";
import { BlogPage } from "../pages/public/BlogPage";
import { BlogDetailPage } from "../pages/public/BlogDetailPage";
import { TournamentsPage } from "../pages/public/TournamentsPage";
import { TournamentDetailPage } from "../pages/public/TournamentDetailPage";
import { TeammateCreatePage } from "../pages/public/TeammateCreatePage";
import { TeammateDetailPage } from "../pages/public/TeammateDetailPage";
import { TeammatesPage } from "../pages/public/TeammatesPage";
import { LoginPage } from "../pages/auth/LoginPage";
import { RegisterPage } from "../pages/auth/RegisterPage";
import { RegisterPartnerPage } from "../pages/auth/RegisterPartnerPage";
import { BookingPage } from "../pages/user/BookingPage";
import { PaymentPage } from "../pages/user/PaymentPage";
import { UserProfilePage } from "../pages/user/UserProfilePage";
import { UserBookingsPage } from "../pages/user/UserBookingsPage";
import { UserBookingDetailPage } from "../pages/user/UserBookingDetailPage";
import { PartnerDashboardPage } from "../pages/partner/PartnerDashboardPage";
import { PartnerCourtsPage } from "../pages/partner/PartnerCourtsPage";
import { PartnerCourtFormPage } from "../pages/partner/PartnerCourtFormPage";
import { PartnerBookingsPage } from "../pages/partner/PartnerBookingsPage";
import { PartnerStatisticsPage } from "../pages/partner/PartnerStatisticsPage";
import { PartnerVouchersPage } from "../pages/partner/PartnerVouchersPage";
import { PartnerVoucherFormPage } from "../pages/partner/PartnerVoucherFormPage";
import { PartnerPlaceholderPage } from "../pages/partner/PartnerPlaceholderPage";
import { PartnerCourtResourcesPage } from "../pages/partner/PartnerCourtResourcesPage";
import { PartnerSettingsPage } from "../pages/partner/PartnerSettingsPage";
import { PartnerCalendarPage } from "../pages/partner/PartnerCalendarPage";
import { PartnerBlogsPage } from "../pages/partner/PartnerBlogsPage";
import { PartnerBlogFormPage } from "../pages/partner/PartnerBlogFormPage";
import { PartnerTournamentsPage } from "../pages/partner/PartnerTournamentsPage";
import { PartnerTournamentFormPage } from "../pages/partner/PartnerTournamentFormPage";
import { AdminDashboardPage } from "../pages/admin/AdminDashboardPage";
import { AdminBookingsPage } from "../pages/admin/AdminBookingsPage";
import { AdminUsersPage } from "../pages/admin/AdminUsersPage";
import { AdminPartnersPage } from "../pages/admin/AdminPartnersPage";
import { AdminCourtsPage } from "../pages/admin/AdminCourtsPage";
import { AdminPendingCourtsPage } from "../pages/admin/AdminPendingCourtsPage";
import { AdminCategoriesPage } from "../pages/admin/AdminCategoriesPage";
import { AdminReviewsPage } from "../pages/admin/AdminReviewsPage";
import { AdminReportsPage } from "../pages/admin/AdminReportsPage";
import { AdminStatisticsPage } from "../pages/admin/AdminStatisticsPage";
import { AdminAuditLogsPage } from "../pages/admin/AdminAuditLogsPage";
import { AdminBlockchainLogsPage } from "../pages/admin/AdminBlockchainLogsPage";
import { AdminCommissionSettingsPage } from "../pages/admin/AdminCommissionSettingsPage";
import { AdminFinancePage } from "../pages/admin/AdminFinancePage";
import { AdminNotificationsPage } from "../pages/admin/AdminNotificationsPage";
import { AdminPartnerCommissionPage } from "../pages/admin/AdminPartnerCommissionPage";
import { AdminVouchersPage } from "../pages/admin/AdminVouchersPage";
import { AdminBlogModerationPage } from "../pages/admin/AdminBlogModerationPage";
import { AdminTournamentModerationPage } from "../pages/admin/AdminTournamentModerationPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="partner/login" element={<LoginPage mode="partner" />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="register-partner" element={<RegisterPartnerPage />} />
        <Route path="partner" element={<PartnersLandingPage />} />
        <Route path="partners" element={<PartnersLandingPage />} />
        <Route path="vouchers" element={<VouchersPage />} />
        <Route path="blog" element={<BlogPage />} />
        <Route path="blogs" element={<BlogPage />} />
        <Route path="blogs/:slug" element={<BlogDetailPage />} />
        <Route path="tournaments" element={<TournamentsPage />} />
        <Route path="tournaments/:slug" element={<TournamentDetailPage />} />
        <Route path="teammates" element={<TeammatesPage />} />
        <Route path="teammates/:id" element={<TeammateDetailPage />} />
        <Route path="courts" element={<CourtsPage />} />
        <Route path="courts/:id" element={<CourtDetailPage />} />
        <Route element={<ProtectedRoute roles={["USER"]} />}>
          <Route path="teammates/create" element={<TeammateCreatePage />} />
          <Route path="booking/:courtId" element={<BookingPage />} />
          <Route path="payment/:paymentId" element={<PaymentPage />} />
          <Route path="user/profile" element={<UserProfilePage />} />
          <Route path="user/bookings" element={<UserBookingsPage />} />
          <Route path="user/bookings/:id" element={<UserBookingDetailPage />} />
          <Route path="user/vouchers" element={<PartnerPlaceholderPage title="Voucher" />} />
          <Route path="user/teammates" element={<PartnerPlaceholderPage title="Bài đăng tìm đồng đội của tôi" />} />
          <Route path="user/blogs" element={<PartnerPlaceholderPage title="Bài viết của tôi" />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={["PARTNER"]} />}>
        <Route element={<DashboardLayout />}>
          <Route path="partner/dashboard" element={<PartnerDashboardPage />} />
          <Route path="partner/courts" element={<PartnerCourtsPage />} />
          <Route path="partner/courts/create" element={<PartnerCourtFormPage />} />
          <Route path="partner/courts/:id/edit" element={<PartnerCourtFormPage />} />
          <Route path="partner/courts/:id/prices" element={<PartnerCourtResourcesPage mode="prices" />} />
          <Route path="partner/courts/:id/services" element={<PartnerCourtResourcesPage mode="services" />} />
          <Route path="partner/courts/:id/images" element={<PartnerCourtResourcesPage mode="images" />} />
          <Route path="partner/bookings" element={<PartnerBookingsPage />} />
          <Route path="partner/vouchers" element={<PartnerVouchersPage />} />
          <Route path="partner/vouchers/create" element={<PartnerVoucherFormPage />} />
          <Route path="partner/vouchers/:id/edit" element={<PartnerVoucherFormPage />} />
          <Route path="partner/tournaments" element={<PartnerTournamentsPage />} />
          <Route path="partner/tournaments/create" element={<PartnerTournamentFormPage />} />
          <Route path="partner/tournaments/:id/edit" element={<PartnerTournamentFormPage />} />
          <Route path="partner/blogs" element={<PartnerBlogsPage />} />
          <Route path="partner/blogs/create" element={<PartnerBlogFormPage />} />
          <Route path="partner/blogs/:id/edit" element={<PartnerBlogFormPage />} />
          <Route path="partner/calendar" element={<PartnerCalendarPage />} />
          <Route path="partner/statistics" element={<PartnerStatisticsPage />} />
          <Route path="partner/settings" element={<PartnerSettingsPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={["ADMIN"]} />}>
        <Route element={<DashboardLayout />}>
          <Route path="admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="admin/bookings" element={<AdminBookingsPage />} />
          <Route path="admin/users" element={<AdminUsersPage />} />
          <Route path="admin/partners" element={<AdminPartnersPage />} />
          <Route path="admin/partners/:id/commission" element={<AdminPartnerCommissionPage />} />
          <Route path="admin/courts" element={<AdminCourtsPage />} />
          <Route path="admin/courts/pending" element={<AdminPendingCourtsPage />} />
          <Route path="admin/categories" element={<AdminCategoriesPage />} />
          <Route path="admin/reviews" element={<AdminReviewsPage />} />
          <Route path="admin/vouchers" element={<AdminVouchersPage />} />
          <Route path="admin/notifications" element={<AdminNotificationsPage />} />
          <Route path="admin/blogs/pending" element={<AdminBlogModerationPage />} />
          <Route path="admin/tournaments/pending" element={<AdminTournamentModerationPage />} />
          <Route path="admin/reports" element={<AdminReportsPage />} />
          <Route path="admin/finance" element={<AdminFinancePage />} />
          <Route path="admin/commission" element={<AdminCommissionSettingsPage />} />
          <Route path="admin/statistics" element={<AdminStatisticsPage />} />
          <Route path="admin/audit-logs" element={<AdminAuditLogsPage />} />
          <Route path="admin/blockchain-logs" element={<AdminBlockchainLogsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
