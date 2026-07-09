import http from "node:http";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/db.js";
import { initRealtime } from "./modules/realtime/realtime.server.js";
import { startPaymentPoller } from "./modules/payments/payment.poller.js";

const server = http.createServer(app);
initRealtime(server);

server.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
  startPaymentPoller();
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
});
