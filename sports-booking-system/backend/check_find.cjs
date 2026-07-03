const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  try {
    const r = await p.userVoucher.findUnique({
      where: { userId_voucherId: { userId: "u0013", voucherId: "v0001" } },
    });
    console.log("findUnique OK:", r);
  } catch (e) {
    console.log("findUnique FAIL:", e.message.slice(0, 300));
  }
  await p.$disconnect();
})();