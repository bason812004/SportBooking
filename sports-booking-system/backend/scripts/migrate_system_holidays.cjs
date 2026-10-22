// Run the voucher funding + system_holidays migrations using a proper Node pg client
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Load .env from backend directory
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

// Use DIRECT_URL for DDL (Supabase connection pooler can't run multi-statement DDL)
const CONN_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!CONN_URL) {
  console.error('ERROR: Neither DATABASE_URL nor DIRECT_URL is set in .env');
  process.exit(1);
}

async function main() {
  console.log(`Connecting to: ${CONN_URL.replace(/:[^:@]+@/, ':****@')}`);
  const c = new Client({ connectionString: CONN_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // Verify connection
  const { rows } = await c.query('SELECT current_database() AS db');
  console.log(`Connected to: ${rows[0].db}`);

  // Read the combined migration file
  const sqlPath = path.join(__dirname, '..', '..', 'database', 'migrate_voucher_funding_and_eligibility.sql');
  let sql = fs.readFileSync(sqlPath, 'utf8');
  // Strip UTF-8 BOM
  if (sql.charCodeAt(0) === 0xFEFF) sql = sql.slice(1);

  // Strip comments and empty lines, split into statements
  const lines = sql.split(/\r?\n/);
  const stmts = [];
  let current = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('--')) continue;
    current.push(line);
    if (trimmed.endsWith(';')) {
      stmts.push(current.join('\n'));
      current = [];
    }
  }

  console.log(`\nExecuting ${stmts.length} statements...`);
  for (let i = 0; i < stmts.length; i++) {
    const stmt = stmts[i].trim();
    if (!stmt) continue;
    try {
      await c.query(stmt);
      console.log(`OK [${i + 1}/${stmts.length}]: ${stmt.slice(0, 70)}`);
    } catch (e) {
      const code = e.code || '';
      // 42P07 = table already exists, 42710 = index already exists, 23505 = duplicate key
      if (code === '42P07' || code === '42710' || code === '23505' || e.message?.includes('already exists') || e.message?.includes('duplicate')) {
        console.log(`SKIP [${i + 1}/${stmts.length}]: ${stmt.slice(0, 70)} (already exists)`);
      } else {
        console.error(`ERROR [${i + 1}/${stmts.length}]: ${e.message.slice(0, 300)}`);
      }
    }
  }

  // Verify vouchers table columns
  const { rows: cols } = await c.query(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vouchers'
    AND column_name IN ('funded_by', 'partner_funding_percent', 'platform_funding_percent',
      'applicable_days', 'start_time', 'end_time', 'holiday_only', 'click_count')
    ORDER BY column_name
  `);
  console.log(`\nVoucher funding/eligibility columns in DB: ${cols.length}/8`);
  cols.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

  // Verify system_holidays
  const { rows: holidays } = await c.query('SELECT count(*)::int as cnt FROM system_holidays');
  console.log(`system_holidays rows: ${holidays[0]?.cnt ?? 0}`);

  await c.end();
  console.log('\nDone.');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });

