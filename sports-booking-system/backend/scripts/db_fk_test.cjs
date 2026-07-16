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
  // Try insert with bogus partner_id
  try {
    await c.query("INSERT INTO partner_wallets(id, partner_id) VALUES ('pwTEST', 'DOESNOTEXIST')");
    console.log('FK does NOT exist (insert succeeded)');
    await c.query("DELETE FROM partner_wallets WHERE id='pwTEST'");
  } catch (e) {
    console.log('FK is enforced:', e.message);
  }

  // Also check underlying partner_profiles.id format - test "pp9999"
  // And try adding an FK ourselves
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
