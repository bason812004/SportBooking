import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/db.js";
const server = app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`);
});
process.on("SIGINT", async () => {
    await prisma.$disconnect();
    server.close(() => process.exit(0));
});
