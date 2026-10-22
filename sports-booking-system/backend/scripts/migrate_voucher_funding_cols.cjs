// Run missing voucher funding columns - idempotent, safe to re-run
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const txt = fs.readFileSync(envPath, 'utf8');
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

const CONN_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!CONN_URL) { console.error('No DATABASE_URL'); process.exit(1); }

const c = new Client({ connectionString: CONN_URL, ssl: { rejectUnauthorized: false } });

const MISSING_STATEMENTS = [
  // 1. Create the enum type (safe if already exists)
  `CREATE TYPE voucher_funded_by AS ENUM ('PARTNER', 'PLATFORM', 'SHARED')`,

  // 2. Add funding columns
  `ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS funded_by voucher_funded_by NOT NULL DEFAULT 'PARTNER'`,
  `ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS partner_funding_percent numeric(5, 2) NOT NULL DEFAULT 100.00 CONSTRAINT chk_partner_funding CHECK (partner_funding_percent >= 0 AND partner_funding_percent <= 100)`,
  `ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS platform_funding_percent numeric(5, 2) NOT NULL DEFAULT 0.00 CONSTRAINT chk_platform_funding CHECK (platform_funding_percent >= 0 AND platform_funding_percent <= 100)`,

  // 3. Add eligibility columns that might be missing
  `ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS holiday_dates date[] DEFAULT NULL`,
  `ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS applicable_start_date timestamptz DEFAULT NULL`,
  `ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS applicable_end_date timestamptz DEFAULT NULL`,

  // 4. Create the trigger function (replace if exists)
  `CREATE OR REPLACE FUNCTION trg_touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $trigger$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $trigger$`,

  // 5. Index on funded_by
  `CREATE INDEX IF NOT EXISTS idx_vouchers_funded_by ON vouchers(funded_by)`
];

async function main() {
  await c.connect();
  console.log('Connected to:', (await c.query('SELECT current_database()')).rows[0].current_database);

  for (const stmt of MISSING_STATEMENTS) {
    try {
      await c.query(stmt);
      console.log('OK:', stmt.slice(0, 80));
    } catch (e) {
      if (e.code === '42710' || e.code === '23505' || e.message?.includes('already exists') || e.message?.includes('duplicate')) {
        console.log('SKIP:', stmt.slice(0, 80));
      } else if (e.code === '42723') {
        // duplicate type
        console.log('SKIP:', stmt.slice(0, 80), '(type already exists)');
      } else {
        console.error('ERROR:', e.message.slice(0, 300));
      }
    }
  }

  // Final check
  const { rows: cols } = await c.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vouchers'
    AND column_name IN (
      'funded_by', 'partner_funding_percent', 'platform_funding_percent',
      'applicable_days', 'start_time', 'end_time', 'holiday_only',
      'holiday_dates', 'applicable_start_date', 'applicable_end_date', 'click_count'
    )
    ORDER BY column_name
  `);
  console.log(`\nVoucher columns now: ${cols.length}/11 found:`);
  cols.forEach(r => console.log(' ', r.column_name));

  const missing = [
    'funded_by', 'partner_funding_percent', 'platform_funding_percent',
    'applicable_days', 'start_time', 'end_time', 'holiday_only',
    'holiday_dates', 'applicable_start_date', 'applicable_end_date', 'click_count'
  ].filter(c => !cols.find(x => x.column_name === c));
  if (missing.length > 0) {
    console.error('\nStill MISSING:', missing.join(', '));
    process.exit(1);
  } else {
    console.log('\nAll voucher columns present. Backend should work now!');
  }

  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
