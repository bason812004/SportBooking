// Final Prisma smoke test
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
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  // Smoke tests via Prisma
  const wallets = await p.partnerWallet.count();
  console.log('partner_wallets count:', wallets);

  const plat = await p.voucher.count({ where: { fundedBy: 'PLATFORM' } });
  console.log('PLATFORM vouchers:', plat);

  const v = await p.voucher.findMany({
    where: { fundedBy: 'PLATFORM' },
    select: { code: true, fundedBy: true, status: true, partnerFundingPercent: true, platformFundingPercent: true, startDate: true, endDate: true },
    orderBy: { code: 'asc' },
  });
  console.log('\nPlatform voucher detail:');
  for (const r of v) console.log(' ', JSON.stringify(r));

  const sampleSettlement = await p.settlement.count();
  console.log('\nsettlements rows:', sampleSettlement);

  const sampleWithdrawal = await p.withdrawalRequest.count();
  console.log('withdrawal_requests rows:', sampleWithdrawal);

  // Insert audit is allowed?
  // Just inspect schema:
  const cols = await p.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_name='settlements' ORDER BY ordinal_position");
  console.log('\nsettlements columns:', cols.map(c => c.column_name).join(', '));

  await p.$disconnect();
  console.log('\nPrisma client: OK');
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
