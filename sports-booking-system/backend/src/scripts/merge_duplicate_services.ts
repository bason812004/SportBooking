import { prisma } from "../config/db.js";

// Bulk (set-based) version — the earlier row-by-row version needed ~10-15 round-trips
// per duplicate row (thousands of them), which was projected to take hours against
// Supabase's observed latency. This does the same merge in ~8 statements total.
async function main() {
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`
        CREATE TEMP TABLE dup_map ON COMMIT DROP AS
        WITH ranked AS (
          SELECT
            s.id,
            s.partner_id,
            s.name,
            s.created_at,
            EXISTS (SELECT 1 FROM booking_services bs WHERE bs.service_id = s.id::text) AS has_booking_ref,
            ROW_NUMBER() OVER (
              PARTITION BY s.partner_id, s.name
              ORDER BY (EXISTS (SELECT 1 FROM booking_services bs WHERE bs.service_id = s.id::text)) DESC, s.created_at ASC
            ) AS rn
          FROM services s
        ),
        keep_map AS (
          SELECT partner_id, name, id AS keep_id FROM ranked WHERE rn = 1
        )
        SELECT s.id AS dup_id, k.keep_id
        FROM services s
        JOIN keep_map k ON k.partner_id = s.partner_id AND k.name = s.name
        WHERE s.id <> k.keep_id;
      `);

      const [{ count: dupCount }] = await tx.$queryRawUnsafe<{ count: bigint }[]>(`SELECT COUNT(*) as count FROM dup_map;`);
      console.log(`Số dòng dịch vụ trùng cần gộp: ${dupCount}`);

      const bsUpdated = await tx.$executeRawUnsafe(`
        UPDATE booking_services bs SET service_id = dm.keep_id::text
        FROM dup_map dm WHERE bs.service_id = dm.dup_id::text;
      `);
      const itxUpdated = await tx.$executeRawUnsafe(`
        UPDATE inventory_transactions it SET service_id = dm.keep_id
        FROM dup_map dm WHERE it.service_id = dm.dup_id;
      `);
      const poiUpdated = await tx.$executeRawUnsafe(`
        UPDATE purchase_order_items poi SET service_id = dm.keep_id
        FROM dup_map dm WHERE poi.service_id = dm.dup_id;
      `);
      const riUpdated = await tx.$executeRawUnsafe(`
        UPDATE rental_items ri SET service_id = dm.keep_id
        FROM dup_map dm WHERE ri.service_id = dm.dup_id;
      `);
      console.log(`Re-point dữ liệu thật: booking_services=${bsUpdated}, inventory_transactions=${itxUpdated}, purchase_order_items=${poiUpdated}, rental_items=${riUpdated}`);

      const csRepointed = await tx.$executeRawUnsafe(`
        UPDATE court_services cs SET service_id = dm.keep_id
        FROM dup_map dm WHERE cs.service_id = dm.dup_id;
      `);
      console.log(`Re-point court_services: ${csRepointed}`);

      const csDeduped = await tx.$executeRawUnsafe(`
        DELETE FROM court_services cs
        USING (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY court_id, service_id ORDER BY created_at ASC) AS rn
          FROM court_services
          WHERE service_id IS NOT NULL
        ) ranked
        WHERE cs.id = ranked.id AND ranked.rn > 1;
      `);
      console.log(`Xoá court_services trùng sau khi re-point (cùng sân, cùng dịch vụ gốc): ${csDeduped}`);

      const servicesDeleted = await tx.$executeRawUnsafe(`
        DELETE FROM services s
        USING dup_map dm
        WHERE s.id = dm.dup_id;
      `);
      console.log(`Đã xoá ${servicesDeleted} dòng dịch vụ trùng.`);
    },
    { timeout: 120_000 }
  );

  console.log("=== Xong. ===");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
