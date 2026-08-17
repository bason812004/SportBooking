const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const txs = await prisma.$queryRawUnsafe(`
    SELECT id, service_id, type, quantity, reference_type, reference_id, note, created_at
    FROM inventory_transactions
    WHERE service_id = '05c97fb5-677f-448e-b3f9-1234061b78df'
    ORDER BY created_at DESC LIMIT 20;
  `);
  console.log("TRANSACTIONS:", JSON.stringify(txs, null, 2));

  const bs = await prisma.$queryRawUnsafe(`
    SELECT bs.id, bs.booking_id, bs.service_id, bs.quantity, bs.status, bs.created_at, bs.updated_at
    FROM booking_services bs
    WHERE bs.service_id = '05c97fb5-677f-448e-b3f9-1234061b78df'
    ORDER BY bs.updated_at DESC LIMIT 20;
  `);
  console.log("BOOKING_SERVICES:", JSON.stringify(bs, null, 2));
  await prisma.$disconnect();
})();
