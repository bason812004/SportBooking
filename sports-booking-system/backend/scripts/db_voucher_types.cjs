const fs=require('fs'),path=require('path'),{Client}=require('pg');
const ep=path.join(__dirname,'..','.env');
if(fs.existsSync(ep)){const t=fs.readFileSync(ep,'utf8');for(const r of t.split(/\r?\n/)){const l=r.trim();if(!l||l.startsWith('#'))continue;const eq=l.indexOf('=');if(eq<0)continue;const k=l.slice(0,eq).trim();let v=l.slice(eq+1).trim();if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1);if(!process.env[k])process.env[k]=v;}}
(async()=>{
  const c=new Client({connectionString:process.env.DIRECT_URL||process.env.DATABASE_URL});
  await c.connect();
  // Check exact column types
  const cols = await c.query(`
    SELECT column_name, data_type, character_maximum_length
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vouchers' AND column_name IN ('applicable_days','start_time','end_time','holiday_only','holiday_dates','applicable_start_date','applicable_end_date')
    ORDER BY column_name
  `);
  console.log('Voucher columns:');
  for (const r of cols.rows) console.log('  ', JSON.stringify(r));

  // Check holiday raw
  const h = await c.query(`SELECT holiday_date::text AS raw, holiday_date::date AS dateonly, name FROM system_holidays WHERE id='hl-01-01'`);
  console.log('\nhl-01-01 raw:', JSON.stringify(h.rows));
  await c.end();
})().catch(e=>{console.error(e.message);process.exit(1);});