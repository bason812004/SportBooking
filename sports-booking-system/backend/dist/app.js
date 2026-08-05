import compression from "compression";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { swaggerSpec } from "./config/swagger.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { performanceLogger } from "./middlewares/performance.middleware.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";
import { adminAnalyticsRoutes, partnerAnalyticsRoutes } from "./modules/analytics/analytics.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { blogRoutes } from "./modules/blogs/blog.routes.js";
import { bookingRoutes } from "./modules/bookings/booking.routes.js";
import { categoryRoutes } from "./modules/categories/category.routes.js";
import { courtRoutes } from "./modules/courts/court.routes.js";
import { publicDemandPredictionRoutes, partnerDemandPredictionRoutes } from "./modules/demand-prediction/demandPrediction.routes.js";
import { publicDynamicPricingRoutes, partnerDynamicPricingRoutes } from "./modules/dynamic-pricing/dynamicPricing.routes.js";
import { partnerRoutes } from "./modules/partner/partner.routes.js";
import { recipientRoutes } from "./modules/recipient/recipient.routes.js";
import { notificationRoutes } from "./modules/notifications/notification.routes.js";
import { paymentRoutes } from "./modules/payments/payment.routes.js";
import { payoutRoutes } from "./modules/payouts/payout.routes.js";
import { reportRoutes } from "./modules/reports/report.routes.js";
import { reviewRoutes } from "./modules/reviews/review.routes.js";
import { teamPostRoutes } from "./modules/team-posts/teamPost.routes.js";
import { partnerTournamentRoutes } from "./modules/tournaments/tournamentPrivate.routes.js";
import { tournamentRoutes } from "./modules/tournaments/tournament.routes.js";
import { sportTypeRoutes } from "./modules/sport-types/sportType.routes.js";
import { userRoutes } from "./modules/users/user.routes.js";
import { bookingVoucherRoutes, partnerVoucherRoutes, userVoucherRoutes } from "./modules/vouchers/voucherPrivate.routes.js";
import { voucherRoutes } from "./modules/vouchers/voucher.routes.js";
import { weeklyScheduleRoutes } from "./modules/weekly-schedule/weeklySchedule.routes.js";
import { partnerWalletRoutes, adminWalletRoutes } from "./modules/wallets/wallet.routes.js";
import { partnerSettlementRoutes, adminSettlementRoutes } from "./modules/settlements/settlement.routes.js";
import { partnerWithdrawalRoutes, adminWithdrawalRoutes } from "./modules/withdrawals/withdrawal.routes.js";
import { uploadRoutes } from "./modules/uploads/upload.routes.js";
export const app = express();
const allowedOrigins = new Set([
    env.FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173"
]);
app.use(helmet());
app.use(compression());
app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin))
            return callback(null, true);
        return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(performanceLogger);
app.get("/health", (_req, res) => res.json({ success: true, data: { status: "ok" } }));
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
const authRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false });
app.use("/api/auth", authRateLimit);
app.use("/api/auth", authRoutes);
app.use("/api/courts/:courtId/dynamic-price", publicDynamicPricingRoutes);
app.use("/api/courts/:courtId/demand-prediction", publicDemandPredictionRoutes);
app.use("/api/courts/:courtId/weekly-schedule", weeklyScheduleRoutes);
app.use("/api/sport-types", sportTypeRoutes);
app.use("/api/courts", courtRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/payouts", payoutRoutes);
app.use("/api/vouchers", voucherRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/tournaments", tournamentRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/users", userVoucherRoutes);
app.use("/api/users", notificationRoutes);
app.use("/api/users", userRoutes);
app.use("/api/bookings", bookingVoucherRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/team-posts", teamPostRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/partner/dynamic-pricing", partnerDynamicPricingRoutes);
app.use("/api/partner/demand-prediction", partnerDemandPredictionRoutes);
app.use("/api/partner/vouchers", partnerVoucherRoutes);
app.use("/api/partner/tournaments", partnerTournamentRoutes);
app.use("/api/partner/analytics", partnerAnalyticsRoutes);
app.use("/api/partner/wallet", partnerWalletRoutes);
app.use("/api/partner/settlements", partnerSettlementRoutes);
app.use("/api/partner/withdrawals", partnerWithdrawalRoutes);
app.use("/api/partner", partnerRoutes);
app.use("/api/recipient", recipientRoutes);
app.use("/api/admin/analytics", adminAnalyticsRoutes);
app.use("/api/admin/wallets", adminWalletRoutes);
app.use("/api/admin/settlements", adminSettlementRoutes);
app.use("/api/admin/withdrawals", adminWithdrawalRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/uploads", uploadRoutes);
app.use(errorMiddleware);
