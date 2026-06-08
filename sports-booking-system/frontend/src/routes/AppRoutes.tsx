import { Navigate, Route, Routes } from "react-router-dom";
import { PublicLayout } from "../components/layout/PublicLayout";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { ProtectedRoute } from "./ProtectedRoute";
import { HomePage } from "../pages/public/HomePage";
import { CourtsPage } from "../pages/public/CourtsPage";
import { CourtDetailPage } from "../pages/public/CourtDetailPage";
import { PartnersLandingPage } from "../pages/public/PartnersLandingPage";
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
import { PartnerPlaceholderPage } from "../pages/partner/PartnerPlaceholderPage";
import { AdminDashboardPage } from "../pages/admin/AdminDashboardPage";
import { AdminUsersPage } from "../pages/admin/AdminUsersPage";
import { AdminPartnersPage } from "../pages/admin/AdminPartnersPage";
import { AdminPendingCourtsPage } from "../pages/admin/AdminPendingCourtsPage";
import { AdminCategoriesPage } from "../pages/admin/AdminCategoriesPage";
import { AdminReviewsPage } from "../pages/admin/AdminReviewsPage";
import { AdminReportsPage } from "../pages/admin/AdminReportsPage";
import { AdminStatisticsPage } from "../pages/admin/AdminStatisticsPage";
import { AdminAuditLogsPage } from "../pages/admin/AdminAuditLogsPage";
import { AdminBlockchainLogsPage } from "../pages/admin/AdminBlockchainLogsPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="register-partner" element={<RegisterPartnerPage />} />
        <Route path="partners" element={<PartnersLandingPage />} />
        <Route path="courts" element={<CourtsPage />} />
        <Route path="courts/:id" element={<CourtDetailPage />} />
        <Route element={<ProtectedRoute roles={["USER"]} />}>
          <Route path="booking/:courtId" element={<BookingPage />} />
          <Route path="payment/:bookingId" element={<PaymentPage />} />
          <Route path="user/profile" element={<UserProfilePage />} />
          <Route path="user/bookings" element={<UserBookingsPage />} />
          <Route path="user/bookings/:id" element={<UserBookingDetailPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={["PARTNER"]} />}>
        <Route element={<DashboardLayout />}>
          <Route path="partner/dashboard" element={<PartnerDashboardPage />} />
          <Route path="partner/courts" element={<PartnerCourtsPage />} />
          <Route path="partner/courts/create" element={<PartnerCourtFormPage />} />
          <Route path="partner/courts/:id/edit" element={<PartnerCourtFormPage />} />
          <Route path="partner/courts/:id/prices" element={<PartnerPlaceholderPage title="Bang gia" />} />
          <Route path="partner/courts/:id/services" element={<PartnerPlaceholderPage title="Dich vu di kem" />} />
          <Route path="partner/bookings" element={<PartnerBookingsPage />} />
          <Route path="partner/calendar" element={<PartnerPlaceholderPage title="Lich dat san" />} />
          <Route path="partner/statistics" element={<PartnerStatisticsPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={["ADMIN"]} />}>
        <Route element={<DashboardLayout />}>
          <Route path="admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="admin/users" element={<AdminUsersPage />} />
          <Route path="admin/partners" element={<AdminPartnersPage />} />
          <Route path="admin/courts/pending" element={<AdminPendingCourtsPage />} />
          <Route path="admin/categories" element={<AdminCategoriesPage />} />
          <Route path="admin/reviews" element={<AdminReviewsPage />} />
          <Route path="admin/reports" element={<AdminReportsPage />} />
          <Route path="admin/statistics" element={<AdminStatisticsPage />} />
          <Route path="admin/audit-logs" element={<AdminAuditLogsPage />} />
          <Route path="admin/blockchain-logs" element={<AdminBlockchainLogsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
