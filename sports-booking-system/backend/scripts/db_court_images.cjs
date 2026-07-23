const fs=require('fs'),path=require('path'),{Client}=require('pg');
const ep=path.join(__dirname,'..','.env');
if(fs.existsSync(ep)){const t=fs.readFileSync(ep,'utf8');for(const r of t.split(/\r?\n/)){const l=r.trim();if(!l||l.startsWith('#'))continue;const eq=l.indexOf('=');if(eq<0)continue;const k=l.slice(0,eq).trim();let v=l.slice(eq+1).trim();if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1);if(!process.env[k])process.env[k]=v;}}
(async()=>{
  const c=new Client({connectionString:process.env.DIRECT_URL||process.env.DATABASE_URL});
  await c.connect();
  const r=await c.query("SELECT column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_name='court_images' ORDER BY ordinal_position");
  console.log('court_images columns:');
  for(const row of r.rows) console.log('  ',row.column_name,row.data_type,'NULL:'+row.is_nullable);
  // Also check court column type and ID type
  const cid = await c.query("SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name='courts' AND column_name='id'");
  console.log('\ncourts.id:', cid.rows);
  const ciid = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='court_images' AND column_name IN ('id','court_id')");
  console.log('court_images ids:', ciid.rows);
  await c.end();
})().catch(e=>{console.error(e.message);process.exit(1);});