import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { PublicLayout } from "../components/layout/PublicLayout";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { ProtectedRoute } from "./ProtectedRoute";
import { LoadingState } from "../components/common/States";
import { HomePage } from "../pages/public/HomePage";
import { CourtsPage } from "../pages/public/CourtsPage";
import { CourtDetailPage } from "../pages/public/CourtDetailPage";
import { LoginPage } from "../pages/auth/LoginPage";
import { RegisterPage } from "../pages/auth/RegisterPage";

const PartnersLandingPage = lazy(() => import("../pages/public/PartnersLandingPage").then((m) => ({ default: m.PartnersLandingPage })));
const VouchersPage = lazy(() => import("../pages/public/VouchersPage").then((m) => ({ default: m.VouchersPage })));
const BlogPage = lazy(() => import("../pages/public/BlogPage").then((m) => ({ default: m.BlogPage })));
const BlogDetailPage = lazy(() => import("../pages/public/BlogDetailPage").then((m) => ({ default: m.BlogDetailPage })));
const TournamentsPage = lazy(() => import("../pages/public/TournamentsPage").then((m) => ({ default: m.TournamentsPage })));
const TournamentDetailPage = lazy(() => import("../pages/public/TournamentDetailPage").then((m) => ({ default: m.TournamentDetailPage })));
const TeammateCreatePage = lazy(() => import("../pages/public/TeammateCreatePage").then((m) => ({ default: m.TeammateCreatePage })));
const TeammateDetailPage = lazy(() => import("../pages/public/TeammateDetailPage").then((m) => ({ default: m.TeammateDetailPage })));
const TeammatesPage = lazy(() => import("../pages/public/TeammatesPage").then((m) => ({ default: m.TeammatesPage })));
const PoliciesPage = lazy(() => import("../pages/public/PoliciesPage").then((m) => ({ default: m.PoliciesPage })));
const SupportPage = lazy(() => import("../pages/public/SupportPage").then((m) => ({ default: m.SupportPage })));
const RegisterPartnerPage = lazy(() => import("../pages/auth/RegisterPartnerPage").then((m) => ({ default: m.RegisterPartnerPage })));
const BookingPage = lazy(() => import("../pages/user/BookingPage").then((m) => ({ default: m.BookingPage })));
const PaymentPage = lazy(() => import("../pages/user/PaymentPage").then((m) => ({ default: m.PaymentPage })));
const UserProfilePage = lazy(() => import("../pages/user/UserProfilePage").then((m) => ({ default: m.UserProfilePage })));
const UserBookingsPage = lazy(() => import("../pages/user/UserBookingsPage").then((m) => ({ default: m.UserBookingsPage })));
const UserBookingDetailPage = lazy(() => import("../pages/user/UserBookingDetailPage").then((m) => ({ default: m.UserBookingDetailPage })));
const UserVouchersPage = lazy(() => import("../pages/user/UserVouchersPage").then((m) => ({ default: m.UserVouchersPage })));
const UserTeammatesPage = lazy(() => import("../pages/user/UserTeammatesPage").then((m) => ({ default: m.UserTeammatesPage })));
const UserJoinedGroupsPage = lazy(() => import("../pages/user/UserJoinedGroupsPage").then((m) => ({ default: m.UserJoinedGroupsPage })));
const TeamGroupChatPage = lazy(() => import("../pages/user/TeamGroupChatPage").then((m) => ({ default: m.TeamGroupChatPage })));
const UserBlogsPage = lazy(() => import("../pages/user/UserBlogsPage").then((m) => ({ default: m.UserBlogsPage })));
const UserBlogFormPage = lazy(() => import("../pages/user/UserBlogFormPage").then((m) => ({ default: m.UserBlogFormPage })));
const RecipientDashboardPage = lazy(() => import("../pages/recipient/RecipientDashboardPage").then((m) => ({ default: m.RecipientDashboardPage })));
const RecipientBookingsPage = lazy(() => import("../pages/recipient/RecipientBookingsPage").then((m) => ({ default: m.RecipientBookingsPage })));
const RecipientCourtSurfacesPage = lazy(() => import("../pages/recipient/RecipientCourtSurfacesPage").then((m) => ({ default: m.RecipientCourtSurfacesPage })));
const CashierBookingPosPage = lazy(() => import("../pages/cashier/CashierBookingPosPage").then((m) => ({ default: m.CashierBookingPosPage })));
const PartnerStaffPage = lazy(() => import("../pages/partner/PartnerStaffPage").then((m) => ({ default: m.PartnerStaffPage })));
const PartnerDashboardPage = lazy(() => import("../pages/partner/PartnerDashboardPage").then((m) => ({ default: m.PartnerDashboardPage })));
const PartnerCourtsPage = lazy(() => import("../pages/partner/PartnerCourtsPage").then((m) => ({ default: m.PartnerCourtsPage })));
const PartnerCourtFormPage = lazy(() => import("../pages/partner/PartnerCourtFormPage").then((m) => ({ default: m.PartnerCourtFormPage })));
const PartnerBookingsPage = lazy(() => import("../pages/partner/PartnerBookingsPage").then((m) => ({ default: m.PartnerBookingsPage })));
const PartnerStatisticsPage = lazy(() => import("../pages/partner/PartnerStatisticsPage").then((m) => ({ default: m.PartnerStatisticsPage })));
const PartnerDynamicPricingPage = lazy(() => import("../pages/partner/PartnerDynamicPricingPage").then((m) => ({ default: m.PartnerDynamicPricingPage })));
const PartnerDynamicPricingFormPage = lazy(() => import("../pages/partner/PartnerDynamicPricingFormPage").then((m) => ({ default: m.PartnerDynamicPricingFormPage })));
const PartnerDemandPredictionPage = lazy(() => import("../pages/partner/PartnerDemandPredictionPage").then((m) => ({ default: m.PartnerDemandPredictionPage })));
const PartnerVouchersPage = lazy(() => import("../pages/partner/PartnerVouchersPage").then((m) => ({ default: m.PartnerVouchersPage })));
const PartnerVoucherFormPage = lazy(() => import("../pages/partner/PartnerVoucherFormPage").then((m) => ({ default: m.PartnerVoucherFormPage })));
const PartnerCourtResourcesPage = lazy(() => import("../pages/partner/PartnerCourtResourcesPage").then((m) => ({ default: m.PartnerCourtResourcesPage })));
const PartnerSettingsPage = lazy(() => import("../pages/partner/PartnerSettingsPage").then((m) => ({ default: m.PartnerSettingsPage })));
const PartnerBlogsPage = lazy(() => import("../pages/partner/PartnerBlogsPage").then((m) => ({ default: m.PartnerBlogsPage })));
const PartnerBlogFormPage = lazy(() => import("../pages/partner/PartnerBlogFormPage").then((m) => ({ default: m.PartnerBlogFormPage })));
const PartnerTournamentsPage = lazy(() => import("../pages/partner/PartnerTournamentsPage").then((m) => ({ default: m.PartnerTournamentsPage })));
const PartnerTournamentFormPage = lazy(() => import("../pages/partner/PartnerTournamentFormPage").then((m) => ({ default: m.PartnerTournamentFormPage })));
const PartnerWalletPage = lazy(() => import("../pages/partner/PartnerWalletPage").then((m) => ({ default: m.PartnerWalletPage })));
const PartnerServicesPage = lazy(() => import("../pages/partner/PartnerServicesPage").then((m) => ({ default: m.PartnerServicesPage })));
const PartnerInventoryPage = lazy(() => import("../pages/partner/PartnerInventoryPage").then((m) => ({ default: m.PartnerInventoryPage })));
const PartnerPurchasesPage = lazy(() => import("../pages/partner/PartnerPurchasesPage").then((m) => ({ default: m.PartnerPurchasesPage })));
const PartnerCashierPage = lazy(() => import("../pages/partner/PartnerCashierPage").then((m) => ({ default: m.PartnerCashierPage })));
const PartnerCheckoutsPage = lazy(() => import("../pages/partner/PartnerCheckoutsPage").then((m) => ({ default: m.PartnerCheckoutsPage })));
const BookingCheckoutPage = lazy(() => import("../pages/user/BookingCheckoutPage").then((m) => ({ default: m.BookingCheckoutPage })));
const AdminDashboardPage = lazy(() => import("../pages/admin/AdminDashboardPage").then((m) => ({ default: m.AdminDashboardPage })));
const AdminBookingsPage = lazy(() => import("../pages/admin/AdminBookingsPage").then((m) => ({ default: m.AdminBookingsPage })));
const AdminUsersPage = lazy(() => import("../pages/admin/AdminUsersPage").then((m) => ({ default: m.AdminUsersPage })));
const AdminPartnersPage = lazy(() => import("../pages/admin/AdminPartnersPage").then((m) => ({ default: m.AdminPartnersPage })));
const AdminCourtsPage = lazy(() => import("../pages/admin/AdminCourtsPage").then((m) => ({ default: m.AdminCourtsPage })));
const AdminPendingCourtsPage = lazy(() => import("../pages/admin/AdminPendingCourtsPage").then((m) => ({ default: m.AdminPendingCourtsPage })));
const AdminCategoriesPage = lazy(() => import("../pages/admin/AdminCategoriesPage").then((m) => ({ default: m.AdminCategoriesPage })));
const AdminReviewsPage = lazy(() => import("../pages/admin/AdminReviewsPage").then((m) => ({ default: m.AdminReviewsPage })));
const AdminReportsPage = lazy(() => import("../pages/admin/AdminReportsPage").then((m) => ({ default: m.AdminReportsPage })));
const AdminStatisticsPage = lazy(() => import("../pages/admin/AdminStatisticsPage").then((m) => ({ default: m.AdminStatisticsPage })));
const AdminAuditLogsPage = lazy(() => import("../pages/admin/AdminAuditLogsPage").then((m) => ({ default: m.AdminAuditLogsPage })));
const AdminBlockchainLogsPage = lazy(() => import("../pages/admin/AdminBlockchainLogsPage").then((m) => ({ default: m.AdminBlockchainLogsPage })));
const AdminCommissionSettingsPage = lazy(() => import("../pages/admin/AdminCommissionSettingsPage").then((m) => ({ default: m.AdminCommissionSettingsPage })));
const AdminFinancePage = lazy(() => import("../pages/admin/AdminFinancePage").then((m) => ({ default: m.AdminFinancePage })));
const AdminNotificationsPage = lazy(() => import("../pages/admin/AdminNotificationsPage").then((m) => ({ default: m.AdminNotificationsPage })));
const AdminPartnerCommissionPage = lazy(() => import("../pages/admin/AdminPartnerCommissionPage").then((m) => ({ default: m.AdminPartnerCommissionPage })));
const AdminVouchersPage = lazy(() => import("../pages/admin/AdminVouchersPage").then((m) => ({ default: m.AdminVouchersPage })));
const AdminVoucherFormPage = lazy(() => import("../pages/admin/AdminVoucherFormPage").then((m) => ({ default: m.AdminVoucherFormPage })));
const AdminBlogModerationPage = lazy(() => import("../pages/admin/AdminBlogModerationPage").then((m) => ({ default: m.AdminBlogModerationPage })));
const AdminTournamentModerationPage = lazy(() => import("../pages/admin/AdminTournamentModerationPage").then((m) => ({ default: m.AdminTournamentModerationPage })));
const AdminSettlementsPage = lazy(() => import("../pages/admin/AdminSettlementsPage").then((m) => ({ default: m.AdminSettlementsPage })));
const AdminWithdrawalsPage = lazy(() => import("../pages/admin/AdminWithdrawalsPage").then((m) => ({ default: m.AdminWithdrawalsPage })));

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <LoadingState />
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="login/customer" element={<LoginPage mode="user" />} />
          <Route path="login/partner" element={<LoginPage mode="partner" />} />
          <Route path="partner/login" element={<LoginPage mode="partner" />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="register/customer" element={<RegisterPage />} />
          <Route path="register/partner" element={<RegisterPartnerPage />} />
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
          <Route path="policies" element={<PoliciesPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route element={<ProtectedRoute roles={["USER"]} />}>
            <Route path="teammates/create" element={<TeammateCreatePage />} />
            <Route path="user/teammates/:id/edit" element={<TeammateCreatePage />} />
            <Route path="booking/:courtId" element={<BookingPage />} />
            <Route path="booking/:bookingId/checkout" element={<BookingCheckoutPage />} />
            <Route path="payment/:paymentId" element={<PaymentPage />} />
            <Route path="user/profile" element={<UserProfilePage />} />
            <Route path="user/bookings" element={<UserBookingsPage />} />
            <Route path="user/bookings/:id" element={<UserBookingDetailPage />} />
            <Route path="user/vouchers" element={<UserVouchersPage />} />
            <Route path="user/teammates" element={<UserTeammatesPage />} />
            <Route path="user/team-groups" element={<UserJoinedGroupsPage />} />
            <Route path="user/team-groups/:id/chat" element={<TeamGroupChatPage />} />
            <Route path="user/blogs" element={<UserBlogsPage />} />
            <Route path="user/blogs/create" element={<UserBlogFormPage />} />
            <Route path="user/blogs/:id/edit" element={<UserBlogFormPage />} />
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
            <Route path="partner/courts/:id/blocks" element={<PartnerCourtResourcesPage mode="blocks" />} />
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
            <Route path="partner/calendar" element={<Navigate to="/partner/bookings?view=calendar" replace />} />
            <Route path="partner/statistics" element={<PartnerStatisticsPage />} />
            <Route path="partner/dynamic-pricing" element={<PartnerDynamicPricingPage />} />
            <Route path="partner/dynamic-pricing/create" element={<PartnerDynamicPricingFormPage />} />
            <Route path="partner/dynamic-pricing/:id/edit" element={<PartnerDynamicPricingFormPage />} />
            <Route path="partner/demand-prediction" element={<PartnerDemandPredictionPage />} />
            <Route path="partner/wallet" element={<PartnerWalletPage />} />
            <Route path="partner/services" element={<PartnerServicesPage />} />
            <Route path="partner/inventory" element={<PartnerInventoryPage />} />
            <Route path="partner/purchases" element={<PartnerPurchasesPage />} />
            <Route path="partner/cashier" element={<PartnerCashierPage />} />
            <Route path="partner/pos/:bookingId" element={<CashierBookingPosPage />} />
            <Route path="partner/checkouts" element={<PartnerCheckoutsPage />} />
            <Route path="partner/settings" element={<PartnerSettingsPage />} />
            <Route path="partner/staff" element={<PartnerStaffPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={["RECIPIENT"]} />}>
          <Route element={<DashboardLayout />}>
            <Route path="recipient/dashboard" element={<RecipientDashboardPage />} />
            <Route path="recipient/cashier" element={<PartnerCashierPage />} />
            <Route path="recipient/pos/:bookingId" element={<CashierBookingPosPage />} />
            <Route path="recipient/services" element={<PartnerServicesPage />} />
            <Route path="recipient/inventory" element={<PartnerInventoryPage />} />
            <Route path="recipient/purchases" element={<PartnerPurchasesPage />} />
            <Route path="recipient/checkouts" element={<PartnerCheckoutsPage />} />
            <Route path="recipient/bookings" element={<RecipientBookingsPage />} />
            <Route path="recipient/calendar" element={<Navigate to="/recipient/bookings?view=calendar" replace />} />
            <Route path="recipient/court-surfaces" element={<RecipientCourtSurfacesPage />} />
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
            <Route path="admin/vouchers/create" element={<AdminVoucherFormPage />} />
            <Route path="admin/vouchers/:id/edit" element={<AdminVoucherFormPage />} />
            <Route path="admin/notifications" element={<AdminNotificationsPage />} />
            <Route path="admin/blogs/pending" element={<AdminBlogModerationPage />} />
            <Route path="admin/tournaments/pending" element={<AdminTournamentModerationPage />} />
            <Route path="admin/reports" element={<AdminReportsPage />} />
            <Route path="admin/finance" element={<AdminFinancePage />} />
            <Route path="admin/settlements" element={<AdminSettlementsPage />} />
            <Route path="admin/withdrawals" element={<AdminWithdrawalsPage />} />
            <Route path="admin/commission" element={<AdminCommissionSettingsPage />} />
            <Route path="admin/statistics" element={<AdminStatisticsPage />} />
            <Route path="admin/audit-logs" element={<AdminAuditLogsPage />} />
            <Route path="admin/blockchain-logs" element={<AdminBlockchainLogsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
