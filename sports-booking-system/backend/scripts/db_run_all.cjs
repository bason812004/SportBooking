// Run all SQL files in a directory via raw pg.Client (multi-statement friendly).
// Usage: node scripts/db_run_all.cjs [dir] [--continue] [--only=F.sql] [--stop-after=F.sql]
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadDotenv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
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
loadDotenv();

const argv = process.argv.slice(2);
const continueOnError = argv.includes('--continue');
const only = argv.find(a => a.startsWith('--only='));
const onlyFile = only ? only.slice(7) : null;
const stopAfter = argv.find(a => a.startsWith('--stop-after='));
const stopAfterFile = stopAfter ? stopAfter.slice(13) : null;
const argDir = argv.find(a => !a.startsWith('--'));

const DB_DIR = argDir || path.join(__dirname, '..', '..', 'database');

// Use DIRECT_URL for DDL on Supabase (pgbouncer transaction-mode can't handle multi-statement)
const CONN_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;

const all = fs.readdirSync(DB_DIR).filter(f => f.endsWith('.sql'));
const score = (f) => {
  const m = f.match(/^(\d+)/);
  if (m) return [0, parseInt(m[1], 10), f];
  if (f.startsWith('migrate_')) return [1, f];
  return [2, f];
};
all.sort((a, b) => {
  const [g1, s1, n1] = score(a);
  const [g2, s2, n2] = score(b);
  if (g1 !== g2) return g1 - g2;
  if (s1 !== s2) return (typeof s1 === 'number' ? s1 : 0) - (typeof s2 === 'number' ? s2 : 0);
  return n1.localeCompare(n2);
});

async function withClient(fn) {
  const c = new Client({ connectionString: CONN_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try { return await fn(c); } finally { await c.end(); }
}

async function execFile(c, file, idx, total) {
  const full = path.join(DB_DIR, file);
  let sql = fs.readFileSync(full, 'utf8');
  // Strip UTF-8 BOM if present (Postgres parser rejects it)
  if (sql.charCodeAt(0) === 0xFEFF) sql = sql.slice(1);
  const sizeKB = (sql.length / 1024).toFixed(1);
  const tag = `[${String(idx + 1).padStart(2, '0')}/${total} ${file}]`;
  const start = Date.now();
  try {
    await c.query(sql);
    const ms = Date.now() - start;
    console.log(`${tag} OK (${sizeKB}KB, ${ms}ms)`);
    return { file, ok: true, ms };
  } catch (e) {
    const ms = Date.now() - start;
    const msg = (e.message || String(e)).split('\n').slice(0, 5).join(' | ').slice(0, 400);
    console.error(`${tag} ERROR (${ms}ms): ${msg}`);
    return { file, ok: false, ms, error: msg };
  }
}

(async () => {
  console.log(`DB target: ${CONN_URL.replace(/:[^:@]+@/, ':****@')}`);
  await withClient(async (c) => {
    const v = await c.query('SELECT current_database() AS db, current_user AS usr, version() AS v');
    console.log('Connected:', v.rows[0].db, 'as', v.rows[0].usr);
  });
  console.log(`Running ${all.length} files (lib/pg, multi-statement)\n`);

  const results = [];
  let processed = 0;

  // We open ONE long-lived connection so we can share transaction/session state if needed.
  const c = new Client({ connectionString: CONN_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    for (let i = 0; i < all.length; i++) {
      const f = all[i];
      if (onlyFile && f !== onlyFile) continue;
      const r = await execFile(c, f, i, all.length);
      results.push(r);
      processed++;
      if (!r.ok && !continueOnError) {
        console.error(`\nStopping on error: ${f}. Use --continue to ignore.`);
        break;
      }
      if (stopAfterFile && f === stopAfterFile) {
        console.log(`\nReached stop-after file: ${stopAfterFile}`);
        break;
      }
    }
  } finally {
    await c.end();
  }

  const ok = results.filter(r => r.ok).length;
  const bad = results.filter(r => !r.ok).length;
  console.log(`\n========== SUMMARY ==========`);
  console.log(`Processed: ${processed} of ${all.length} | OK: ${ok} | Failed: ${bad}`);
  if (bad > 0) {
    console.log('Failed files:');
    for (const r of results.filter(r => !r.ok)) console.log('  -', r.file, ':', r.error);
  }
  process.exit(bad > 0 && !continueOnError ? 2 : 0);
})().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
