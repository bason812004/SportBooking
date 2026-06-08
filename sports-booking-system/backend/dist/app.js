import cors from "cors";
import express from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { swaggerSpec } from "./config/swagger.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { bookingRoutes } from "./modules/bookings/booking.routes.js";
import { categoryRoutes } from "./modules/categories/category.routes.js";
import { courtRoutes } from "./modules/courts/court.routes.js";
import { partnerRoutes } from "./modules/partner/partner.routes.js";
import { reportRoutes } from "./modules/reports/report.routes.js";
import { reviewRoutes } from "./modules/reviews/review.routes.js";
import { userRoutes } from "./modules/users/user.routes.js";
export const app = express();
const allowedOrigins = new Set([
    env.FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173"
]);
app.use(helmet());
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
app.get("/health", (_req, res) => res.json({ success: true, data: { status: "ok" } }));
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api/auth", authRoutes);
app.use("/api/courts", courtRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/users", userRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/partner", partnerRoutes);
app.use("/api/admin", adminRoutes);
app.use(errorMiddleware);
