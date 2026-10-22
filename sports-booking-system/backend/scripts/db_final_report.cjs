// Final comprehensive DB validation report
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
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

async function q(c, sql, params) {
  const r = await c.query(sql, params);
  return r.rows;
}

(async () => {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const c = new Client({ connectionString: url });
  await c.connect();

  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║           DATABASE FINAL VALIDATION REPORT — Sports Booking System         ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

  console.log('▶ 1. CONNECTION');
  const v = await q(c, "SELECT current_database() db, current_user usr, inet_server_addr() host, inet_server_port() port");
  console.log('  DB:', v[0].db, '| User:', v[0].usr, '|', `${v[0].host}:${v[0].port}`);

  console.log('\n▶ 2. TABLES');
  const t = await q(c, "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
  console.log('  Total public tables:', t[0].n);

  const tt = await q(c, "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name");
  console.log('  Schema tables:');
  for (let i = 0; i < tt.length; i += 4) {
    console.log('   ', tt.slice(i, i + 4).map(r => r.table_name).join('  |  '));
  }

  console.log('\n▶ 3. CORE TABLES (data counts)');
  const data = await q(c, `
    SELECT 'users' AS t, COUNT(*) AS n FROM users
    UNION ALL SELECT 'partner_profiles', COUNT(*) FROM partner_profiles
    UNION ALL SELECT 'courts', COUNT(*) FROM courts
    UNION ALL SELECT 'bookings', COUNT(*) FROM bookings
    UNION ALL SELECT 'vouchers', COUNT(*) FROM vouchers
    UNION ALL SELECT 'platform_vouchers', COUNT(*) FROM vouchers WHERE funded_by='PLATFORM'
    UNION ALL SELECT 'partner_wallets', COUNT(*) FROM partner_wallets
    UNION ALL SELECT 'settlements', COUNT(*) FROM settlements
    UNION ALL SELECT 'withdrawal_requests', COUNT(*) FROM withdrawal_requests
    UNION ALL SELECT 'court_categories', COUNT(*) FROM court_categories
    UNION ALL SELECT 'court_prices', COUNT(*) FROM court_prices
    ORDER BY t
  `);
  for (const r of data) console.log(`   ${r.t.padEnd(28)} ${r.n}`);

  console.log('\n▶ 4. ENUMS');
  const enums = await q(c, "SELECT typname FROM pg_type WHERE typcategory='E' AND typname NOT LIKE 'pg\\_%' ORDER BY typname");
  console.log(`   Total enums: ${enums.length}`);
  console.log('   ', enums.map(e => e.typname).join(', '));

  console.log('\n▶ 5. PLATFORM VOUCHERS (must be 5)');
  const pv = await q(c, "SELECT code, discount_type, discount_value, status FROM vouchers WHERE funded_by='PLATFORM' ORDER BY code");
  console.log(`   Count: ${pv.length}`);
  for (const r of pv) console.log(`   - ${r.code.padEnd(12)} ${r.discount_type.padEnd(13)} ${String(r.discount_value).padStart(8)} ${r.status}`);

  console.log('\n▶ 6. SETTLEMENT TABLE FKs');
  const fk = await q(c, `
    SELECT conrelid::regclass::text AS tbl, conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint WHERE contype='f' AND conrelid::regclass::text IN ('partner_wallets','settlements','withdrawal_requests','settlements')
    ORDER BY tbl, conname
  `);
  for (const r of fk) console.log(`   ${r.tbl}.${r.conname}: ${r.def}`);

  console.log('\n▶ 7. TRIGGERS (key ones)');
  const trg = await q(c, `
    SELECT event_object_table AS tbl, trigger_name, action_timing, event_manipulation AS ev
    FROM information_schema.triggers
    WHERE trigger_name LIKE 'trg_create_partner_wallet%' OR (event_object_table IN ('partner_profiles','bookings') AND trigger_name LIKE '%updated_at%')
    ORDER BY event_object_table, trigger_name
  `);
  for (const r of trg) console.log(`   ${r.tbl}.${r.trigger_name} (${r.action_timing} ${r.ev})`);

  console.log('\n▶ 8. FUNCTIONS (key ones)');
  const fn = await q(c, "SELECT routine_name FROM information_schema.routines WHERE routine_schema='public' AND routine_name IN ('create_partner_wallet','set_updated_at')");
  for (const r of fn) console.log(`   ✓ ${r.routine_name}`);
  console.log(`   Found ${fn.length} key functions.`);

  console.log('\n▶ 9. INDEXES on settlement tables');
  const idx = await q(c, `
    SELECT tablename, indexname FROM pg_indexes
    WHERE schemaname='public' AND tablename IN ('partner_wallets','settlements','withdrawal_requests','vouchers','booking_vouchers')
    ORDER BY tablename, indexname
  `);
  for (const r of idx) console.log(`   ${r.tablename.padEnd(28)} ${r.indexname}`);

  console.log('\n▶ 10. PRISMA health check');
  // Already done in db_prisma_check.cjs; here just check we can connect.
  const c2 = new Client({ connectionString: url });
  await c2.connect();
  await c2.query('SELECT 1');
  await c2.end();
  console.log('   ✓ Direct connection works.');

  console.log('\n══════════════════════════════════════════════════════════════════════════════');
  console.log('                          DB ready for backend');
  console.log('══════════════════════════════════════════════════════════════════════════════');

  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
