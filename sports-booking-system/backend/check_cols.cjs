const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const cols = await p.$queryRaw`
    SELECT table_name, column_name, data_type, character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name IN ('id', 'user_id', 'voucher_id', 'partner_id', 'booking_id', 'court_id')
    ORDER BY table_name, column_name`;
  for (const c of cols) {
    console.log(`${c.table_name}.${c.column_name}: ${c.data_type}${c.character_maximum_length ? '(' + c.character_maximum_length + ')' : ''}`);
  }
  await p.$disconnect();
})();