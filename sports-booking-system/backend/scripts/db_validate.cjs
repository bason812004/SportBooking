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
(async () => {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const c = new Client({ connectionString: url });
  await c.connect();
  const fk = await c.query(`
    SELECT conrelid::regclass::text AS table_name, conname AS constraint_name, contype, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid::regclass::text IN ('partner_wallets','settlements','withdrawal_requests')
    ORDER BY conrelid::regclass::text, contype, conname
  `);
  console.log('All constraints (by table):');
  for (const r of fk.rows) console.log('  ', r.table_name, r.constraint_name, `[${r.contype}]`, r.definition);

  // Show actual CREATE TABLE by querying columns
  console.log('\npartner_wallets columns:');
  const cols = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='partner_wallets' ORDER BY ordinal_position");
  for (const r of cols.rows) console.log('  ', r.column_name, r.data_type);

  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
