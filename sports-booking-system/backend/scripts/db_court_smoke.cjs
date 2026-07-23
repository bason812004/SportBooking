const fs=require('fs'),path=require('path');
const ep=path.join(__dirname,'..','.env');
if(fs.existsSync(ep)){const t=fs.readFileSync(ep,'utf8');for(const r of t.split(/\r?\n/)){const l=r.trim();if(!l||l.startsWith('#'))continue;const eq=l.indexOf('=');if(eq<0)continue;const k=l.slice(0,eq).trim();let v=l.slice(eq+1).trim();if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1);if(!process.env[k])process.env[k]=v;}}
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  // Test the same query that failed in dev server
  try {
    const [items,total] = await p.$transaction([
      p.court.findMany({take: 2, include: {images: true}}),
      p.court.count(),
    ]);
    console.log('OK courts:', total);
    if (items[0]) {
      console.log('Sample court:', items[0].id, '- images:', items[0].images.length);
      if (items[0].images.length) console.log('First image columns:', Object.keys(items[0].images[0]));
    }
  } catch(e) {
    console.error('Prisma ERR:', e.message.split('\n').slice(0,10).join('\n'));
    process.exit(1);
  }
  await p.$disconnect();
})().catch(e=>{console.error('Fatal:',e.message);process.exit(1);});