require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  try {
    console.log("Running SQL alterations...");
    // 1. Add RECIPIENT value to enum user_role
    await p.$executeRawUnsafe(`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'RECIPIENT'`);
    console.log("OK: Enum user_role updated.");

    // 2. Add partner_id and managed_court_id to users
    await p.$executeRawUnsafe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES partner_profiles(id) ON DELETE CASCADE`);
    console.log("OK: Columns partner_id added.");

    await p.$executeRawUnsafe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS managed_court_id uuid REFERENCES courts(id) ON DELETE SET NULL`);
    console.log("OK: Columns managed_court_id added.");

  } catch (e) {
    console.error("Migration failed:", e);
  } finally {
    await p.$disconnect();
  }
})();
