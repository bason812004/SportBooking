import { prisma } from "../config/db.js";

async function main() {
  const dupGroups: any = await prisma.$queryRawUnsafe(`
    SELECT partner_id as "partnerId", name, array_agg(id ORDER BY created_at ASC) as ids
    FROM services
    GROUP BY partner_id, name
    HAVING COUNT(*) > 1;
  `);

  let deletedCount = 0;
  let skippedCount = 0;

  for (const group of dupGroups) {
    const ids: string[] = group.ids;

    // Prefer the id referenced by booking_services as the one to keep, else the oldest.
    const referenced: any = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT service_id::text as id FROM booking_services WHERE service_id::text = ANY($1::text[]);`,
      ids
    ).catch(() => []);
    const keepId: string = Array.isArray(referenced) && referenced.length > 0 ? referenced[0].id : ids[0];

    const toRemove = ids.filter((id) => id !== keepId);
    console.log(`\n[${group.partnerId}] "${group.name}" — giữ lại ${keepId}, xét xoá ${toRemove.length} bản trùng`);

    for (const id of toRemove) {
      const [bs, cs, poi, ri, tx] = await Promise.all([
        prisma.$queryRawUnsafe(`SELECT 1 FROM booking_services WHERE service_id::text = $1::text LIMIT 1;`, id).catch(() => []),
        prisma.$queryRawUnsafe(`SELECT 1 FROM court_services WHERE service_id::text = $1::text OR id::text = $1::text LIMIT 1;`, id).catch(() => []),
        prisma.$queryRawUnsafe(`SELECT 1 FROM purchase_order_items WHERE service_id::text = $1::text LIMIT 1;`, id).catch(() => []),
        prisma.$queryRawUnsafe(`SELECT 1 FROM rental_items WHERE service_id::text = $1::text LIMIT 1;`, id).catch(() => []),
        prisma.$queryRawUnsafe(`SELECT 1 FROM inventory_transactions WHERE service_id::text = $1::text LIMIT 1;`, id).catch(() => [])
      ]);

      const hasRef = [bs, cs, poi, ri, tx].some((r: any) => Array.isArray(r) && r.length > 0);
      if (hasRef) {
        console.log(`  [BỎ QUA] ${id} — vẫn còn tham chiếu (booking_services/court_services/purchase_order_items/rental_items/inventory_transactions)`);
        skippedCount++;
        continue;
      }

      await prisma.$executeRawUnsafe(`DELETE FROM services WHERE id::text = $1::text;`, id);
      console.log(`  [ĐÃ XOÁ] ${id}`);
      deletedCount++;
    }
  }

  console.log(`\n=== Xong. Đã xoá ${deletedCount} bản trùng, bỏ qua ${skippedCount} bản còn tham chiếu. ===`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
