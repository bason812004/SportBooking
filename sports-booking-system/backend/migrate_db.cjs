require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  try {
    console.log("Running Recipient SQL alterations...");
    const statements = [
      `ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'RECIPIENT'`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS partner_id varchar(20)`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS managed_court_id varchar(20)`,
      `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_partner_id_fkey`,
      `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_managed_court_id_fkey`,
      `ALTER TABLE users ALTER COLUMN partner_id TYPE varchar(20) USING partner_id::text`,
      `ALTER TABLE users ALTER COLUMN managed_court_id TYPE varchar(20) USING managed_court_id::text`,
      `ALTER TABLE users ADD CONSTRAINT users_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES partner_profiles(id) ON DELETE CASCADE`,
      `ALTER TABLE users ADD CONSTRAINT users_managed_court_id_fkey FOREIGN KEY (managed_court_id) REFERENCES courts(id) ON DELETE SET NULL`,
      `CREATE INDEX IF NOT EXISTS idx_users_partner_id ON users(partner_id)`,
      `CREATE INDEX IF NOT EXISTS idx_users_managed_court_id ON users(managed_court_id)`,
      `
        INSERT INTO users (
          id, full_name, email, phone, password_hash, role, provider, provider_id,
          email_verified, status, partner_id, managed_court_id
        )
        SELECT
          'u0091',
          'Recipient San Sala',
          'partner1+recipient@sportsbooking.com',
          '0900000091',
          crypt('123456', gen_salt('bf', 10)),
          'RECIPIENT'::user_role,
          'LOCAL'::auth_provider,
          null,
          true,
          'ACTIVE'::account_status,
          'pp0001',
          'c0001'
        WHERE EXISTS (SELECT 1 FROM partner_profiles WHERE id = 'pp0001')
          AND EXISTS (SELECT 1 FROM courts WHERE id = 'c0001' AND partner_id = 'pp0001')
        ON CONFLICT (email) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          phone = EXCLUDED.phone,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          provider = EXCLUDED.provider,
          provider_id = EXCLUDED.provider_id,
          email_verified = EXCLUDED.email_verified,
          status = EXCLUDED.status,
          partner_id = EXCLUDED.partner_id,
          managed_court_id = EXCLUDED.managed_court_id,
          updated_at = now()
      `
    ];

    for (const statement of statements) {
      await p.$executeRawUnsafe(statement);
    }
    console.log("OK: Recipient role, columns, and demo account are ready.");
  } catch (e) {
    console.error("Migration failed:", e);
  } finally {
    await p.$disconnect();
  }
})();
