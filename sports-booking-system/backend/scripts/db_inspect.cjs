const fs=require('fs'),path=require('path'),{Client}=require('pg');
const ep=path.join(__dirname,'..','.env');
if(fs.existsSync(ep)){const t=fs.readFileSync(ep,'utf8');for(const r of t.split(/\r?\n/)){const l=r.trim();if(!l||l.startsWith('#'))continue;const eq=l.indexOf('=');if(eq<0)continue;const k=l.slice(0,eq).trim();let v=l.slice(eq+1).trim();if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1);if(!process.env[k])process.env[k]=v;}}
(async()=>{
  const c=new Client({connectionString:process.env.DIRECT_URL||process.env.DATABASE_URL});
  await c.connect();
  // Inspect all tables where Prisma expects uuid but DB has varchar
  const r = await c.query(`
    SELECT table_name, column_name, data_type, character_maximum_length
    FROM information_schema.columns
    WHERE table_schema='public'
      AND data_type='character varying'
      AND character_maximum_length=20
      AND column_name IN (
        'id','court_id','partner_id','user_id','booking_id','payment_id','category_id',
        'voucher_id','user_voucher_id','recipient_id','actor_id','processed_by','approved_by',
        'court_surface_id','service_id','review_id','report_id','parent_id','voucher_id',
        'block_id','applied_by','recipient_partner_id'
      )
      AND table_name NOT IN ('partner_wallets','settlements','withdrawal_requests')
    ORDER BY table_name, column_name
  `);
  console.log(`varchar(20) id-like columns: ${r.rows.length}`);
  const groups = {};
  for (const row of r.rows) {
    groups[row.table_name] = groups[row.table_name] || [];
    groups[row.table_name].push(row.column_name);
  }
  for (const [t, cols] of Object.entries(groups)) console.log(`  ${t}: ${cols.join(', ')}`);

  // Also list all tables that have a varchar(20) primary key id
  console.log('\n-- varchar(20) PK tables --');
  const pk = await c.query(`
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(c.relhaverules) IS NOT DISTINCT FROM null
    JOIN pg_constraint con ON con.conrelid = c.oid AND con.contype='p'
    JOIN pg_attribute pk ON pk.attrelid = c.oid AND pk.attnum = ANY(con.conkey)
    WHERE n.nspname='public' AND pk.atttypid = (SELECT oid FROM pg_type WHERE typname='varchar' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname='pg_catalog')) AND character_maximum_length(a.atttypid, a.atttypmod) = 20
  `);
  // Simpler: just check tables with id varchar(20)
  const pk2 = await c.query(`
    SELECT table_name, column_name, data_type, character_maximum_length
    FROM information_schema.columns
    WHERE table_schema='public' AND column_name='id' AND data_type='character varying' AND character_maximum_length=20
    ORDER BY table_name
  `);
  console.log('Tables with id varchar(20):');
  for (const r of pk2.rows) console.log('  ', r.table_name);

  await c.end();
})().catch(e=>{console.error(e.message);process.exit(1);});