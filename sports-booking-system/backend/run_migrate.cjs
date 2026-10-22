require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function trySql(sql, label) {
  for (let i = 0; i < 3; i++) {
    try {
      await p.$executeRawUnsafe(sql);
      console.log("OK:", label);
      return true;
    } catch (e) {
      const msg = e.message || "";
      console.log(`Attempt ${i + 1} FAIL (${label}):`, msg.slice(0, 200));
      if (i < 2) await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return false;
}

(async () => {
  // Users.id (deadlock prone)
  await trySql(`ALTER TABLE users ALTER COLUMN id TYPE varchar(20) USING id::varchar(20)`, "users.id");

  // Drop FK on payments.id, alter, recreate
  const fks = await p.$queryRaw`
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'payments'::regclass
      AND contype = 'f'`;
  for (const fk of fks) {
    await p.$executeRawUnsafe(`ALTER TABLE payments DROP CONSTRAINT IF EXISTS "${fk.conname}"`);
  }
  await trySql(`ALTER TABLE payments ALTER COLUMN id TYPE varchar(20) USING id::varchar(20)`, "payments.id");

  // Check if seed IDs are now compatible
  const u = await p.user.findFirst();
  const v = await p.voucher.findFirst({ where: { status: "ACTIVE" } });
  console.log("user.id:", u?.id, "voucher.id:", v?.id);
  if (u && v) {
    try {
      await p.userVoucher.create({ data: { userId: u.id, voucherId: v.id } });
      console.log("INSERT OK");
      await p.userVoucher.delete({ where: { userId_voucherId: { userId: u.id, voucherId: v.id } } });
    } catch (e) {
      console.log("INSERT FAIL:", e.message);
    }
  }

  await p.$disconnect();
})();