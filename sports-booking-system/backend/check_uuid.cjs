const { randomBytes } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  // 16 hex chars = 16 bytes, fits in varchar(20)
  const id = randomBytes(8).toString("hex");
  console.log("id:", id, "len:", id.length);
  try {
    const rows = await p.$queryRaw`
      INSERT INTO user_vouchers (id, user_id, voucher_id, status, claimed_at)
      VALUES (${id}, ${"u0013"}, ${"v0001"}, 'CLAIMED'::user_voucher_status, NOW())
      RETURNING id, user_id, voucher_id, status, claimed_at
    `;
    console.log("INSERT OK:", rows);
    await p.$queryRaw`DELETE FROM user_vouchers WHERE id = ${id}`;
  } catch (e) {
    console.log("INSERT FAIL:", e.message.slice(0, 400));
  }
  await p.$disconnect();
})();