const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const t = await p.$queryRaw`
    SELECT t.typname FROM pg_type t
    WHERE t.typname ILIKE '%voucher%' OR t.typname ILIKE '%Voucher%'`;
  console.log(t);
  await p.$disconnect();
})();