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
  // What is the seq_voucher if any
  const seq = await c.query("SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema='public' AND sequence_name LIKE 'seq_%' ORDER BY sequence_name");
  console.log('Sequences:', seq.rows);
  // Existing voucher codes (potential conflicts)
  const v = await c.query("SELECT id, code FROM vouchers WHERE code IN ('WELCOME50','SPORT10','WEEKEND15','NIGHT30','SUMMER20')");
  console.log('Existing platform voucher codes:', v.rows);
  // Any short-id sequence?
  const sv = await c.query("SELECT MAX(id) AS max_id, COUNT(*) AS total FROM vouchers");
  console.log('Max voucher id:', sv.rows);
  // Sample existing voucher
  const sv2 = await c.query("SELECT id, code FROM vouchers ORDER BY id DESC LIMIT 3");
  console.log('Recent vouchers:', sv2.rows);
  const seqVal = await c.query("SELECT last_value, is_called FROM seq_vouchers");
  console.log('seq_vouchers:', seqVal.rows);
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
