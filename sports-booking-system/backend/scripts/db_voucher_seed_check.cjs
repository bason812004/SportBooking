const fs=require('fs'),path=require('path'),{Client}=require('pg');
const ep=path.join(__dirname,'..','.env');
if(fs.existsSync(ep)){const t=fs.readFileSync(ep,'utf8');for(const r of t.split(/\r?\n/)){const l=r.trim();if(!l||l.startsWith('#'))continue;const eq=l.indexOf('=');if(eq<0)continue;const k=l.slice(0,eq).trim();let v=l.slice(eq+1).trim();if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1);if(!process.env[k])process.env[k]=v;}}
(async()=>{const c=new Client({connectionString:process.env.DIRECT_URL||process.env.DATABASE_URL});await c.connect();
const v = await c.query(`SELECT code, applicable_days, start_time, end_time, holiday_only, holiday_dates,
  applicable_start_date, applicable_end_date, min_booking_amount
  FROM vouchers WHERE funded_by='PLATFORM' ORDER BY code`);
console.log('Platform vouchers:');
for (const r of v.rows) console.log('  ', JSON.stringify(r));
const h = await c.query(`SELECT id, holiday_date, name, recurring FROM system_holidays ORDER BY holiday_date`);
console.log('\nSystem holidays:', h.rows.length);
for (const r of h.rows) console.log('  ', JSON.stringify(r));
await c.end();})().catch(e=>{console.error(e.message);process.exit(1);});