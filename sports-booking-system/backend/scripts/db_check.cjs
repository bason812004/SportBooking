// Sanity check: connect via Prisma and run a SELECT 1
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  await p.$queryRawUnsafe('SELECT 1 AS ok');
  const v = await p.$queryRawUnsafe("SELECT current_database() db, current_user usr");
  console.log('OK', v);
  await p.$disconnect();
})().catch(async (e) => { console.error('ERR:', e.message); await p.$disconnect(); process.exit(1); });
