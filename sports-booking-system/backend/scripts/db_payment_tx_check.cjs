const fs=require('fs'),path=require('path'),{Client}=require('pg');
const ep=path.join(__dirname,'..','.env');
if(fs.existsSync(ep)){const t=fs.readFileSync(ep,'utf8');for(const r of t.split(/\r?\n/)){const l=r.trim();if(!l||l.startsWith('#'))continue;const eq=l.indexOf('=');if(eq<0)continue;const k=l.slice(0,eq).trim();let v=l.slice(eq+1).trim();if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1);if(!process.env[k])process.env[k]=v;}}
(async()=>{
  const c=new Client({connectionString:process.env.DIRECT_URL||process.env.DATABASE_URL});
  await c.connect();
  const r=await c.query("SELECT conname, contype, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='payment_transactions'::regclass ORDER BY contype, conname");
  console.log('payment_transactions constraints:');
  for(const row of r.rows) console.log('  ', row.conname, '['+row.contype+']', row.def);
  const r2=await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='payment_transactions' ORDER BY ordinal_position");
  console.log('\npayment_transactions columns:');
  for(const row of r2.rows) console.log('  ', row.column_name, row.data_type);
  await c.end();
})().catch(e=>{console.error(e.message);process.exit(1);});