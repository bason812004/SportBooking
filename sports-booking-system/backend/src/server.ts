import http from "node:http";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/db.js";
import { initRealtime } from "./modules/realtime/realtime.server.js";
import { startPaymentPoller } from "./modules/payments/payment.poller.js";
import { ensureTeamChatTables } from "./modules/team-posts/teamPost.repository.js";
import { ensureReviewTables } from "./modules/reviews/review.repository.js";
import { ensureBookingTables } from "./modules/bookings/booking.repository.js";
import { ensureServiceTables } from "./modules/services/service.repository.js";

const server = http.createServer(app);
initRealtime(server);

server.listen(env.PORT, async () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
  try {
    await ensureTeamChatTables().catch((e) => console.warn("[DB Init] teamChat:", e?.message));
    await ensureReviewTables().catch((e) => console.warn("[DB Init] review:", e?.message));
    await ensureBookingTables().catch((e) => console.warn("[DB Init] booking:", e?.message));
    await ensureServiceTables().catch((e) => console.warn("[DB Init] service:", e?.message));
    console.log("Database schema helpers ready");
  } catch (err) {
    console.error("Failed to initialize database tables:", err);
  } finally {
    startPaymentPoller();
  }
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
});

// Trigger reload for resilient raw SQL getActiveBookings implementation
// Reloaded at 2026-08-13 11:52





























