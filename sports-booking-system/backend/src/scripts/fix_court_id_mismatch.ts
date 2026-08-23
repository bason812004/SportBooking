import { prisma } from "../config/db.js";

// One-off repair for services rows whose court_id was corrupted by the old buggy step in
// seed_all_services.ts (see git history) — rows ended up under a court owned by a DIFFERENT
// partner than the service's own partner_id. Referenced rows (real booking/inventory data)
// are detached (court_id -> NULL) rather than deleted, since booking_services/inventory_transactions
// link via service_id, not court_id. Unreferenced rows are pure seed garbage and are deleted.
async function main() {
  await prisma.$transaction(async (tx) => {
    const mismatched: any = await tx.$queryRawUnsafe(`
      SELECT s.id
      FROM services s
      JOIN courts c ON c.id = s.court_id
      WHERE s.partner_id <> c.partner_id;
    `);
    const ids: string[] = mismatched.map((r: any) => r.id);
    console.log(`Số dòng services bị gán sai court_id: ${ids.length}`);
    if (ids.length === 0) return;

    const referenced: any = await tx.$queryRawUnsafe(
      `
      SELECT DISTINCT service_id::text as id FROM booking_services WHERE service_id::text = ANY($1::text[])
      UNION
      SELECT DISTINCT service_id::text as id FROM inventory_transactions WHERE service_id::text = ANY($1::text[])
      UNION
      SELECT DISTINCT service_id::text as id FROM purchase_order_items WHERE service_id::text = ANY($1::text[])
      UNION
      SELECT DISTINCT service_id::text as id FROM rental_items WHERE service_id::text = ANY($1::text[])
      UNION
      SELECT DISTINCT service_id::text as id FROM court_services WHERE service_id::text = ANY($1::text[]);
      `,
      ids
    );
    const referencedIds: string[] = referenced.map((r: any) => r.id);
    const unreferencedIds = ids.filter((id) => !referencedIds.includes(id));

    console.log(`Dòng có tham chiếu thật (gỡ court_id về NULL): ${referencedIds.length}`);
    console.log(`Dòng rác chưa dùng (sẽ xoá): ${unreferencedIds.length}`);

    if (referencedIds.length) {
      const updated = await tx.$executeRawUnsafe(
        `UPDATE services SET court_id = NULL WHERE id::text = ANY($1::text[]);`,
        referencedIds
      );
      console.log(`Đã gỡ court_id: ${updated}`);
    }

    if (unreferencedIds.length) {
      const deleted = await tx.$executeRawUnsafe(
        `DELETE FROM services WHERE id::text = ANY($1::text[]);`,
        unreferencedIds
      );
      console.log(`Đã xoá: ${deleted}`);
    }
  });

  console.log("=== Xong. ===");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
