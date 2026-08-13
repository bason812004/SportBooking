import { prisma } from "../config/db.js";

const PARTNER_ID = "pp0001";

async function main() {
  const services = await prisma.service.findMany({
    where: { partnerId: PARTNER_ID },
    include: { inventory: true }
  });

  const byName = new Map<string, typeof services>();
  for (const s of services) {
    const key = `${s.name}||${s.type}`;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(s);
  }

  const dupGroups = [...byName.entries()].filter(([, arr]) => arr.length > 1);
  console.log(`Tổng số nhóm trùng tên: ${dupGroups.length}`);

  const allDupIds = dupGroups.flatMap(([, arr]) => arr.map((s) => s.id));

  const [bookingSvcRows, invTxRows, poItemRows, rentalItemRows] = await Promise.all([
    prisma.bookingService.groupBy({ by: ["serviceId"], where: { serviceId: { in: allDupIds } }, _count: true }),
    prisma.inventoryTransaction.groupBy({ by: ["serviceId"], where: { serviceId: { in: allDupIds } }, _count: true }),
    prisma.purchaseOrderItem.groupBy({ by: ["serviceId"], where: { serviceId: { in: allDupIds } }, _count: true }),
    prisma.rentalItem.groupBy({ by: ["serviceId"], where: { serviceId: { in: allDupIds } }, _count: true })
  ]);

  const toMap = (rows: any[]) => new Map(rows.map((r) => [r.serviceId, r._count]));
  const bookingSvcMap = toMap(bookingSvcRows);
  const invTxMap = toMap(invTxRows);
  const poItemMap = toMap(poItemRows);
  const rentalItemMap = toMap(rentalItemRows);

  let anyReferenced = false;
  for (const [key, arr] of dupGroups) {
    console.log(`\n=== ${key} (${arr.length} bản ghi) ===`);
    for (const s of arr) {
      const bs = bookingSvcMap.get(s.id) || 0;
      const it = invTxMap.get(s.id) || 0;
      const po = poItemMap.get(s.id) || 0;
      const ri = rentalItemMap.get(s.id) || 0;
      if (bs || it || po || ri) anyReferenced = true;
      console.log(
        `  id=${s.id} createdAt=${s.createdAt.toISOString()} inventory=${s.inventory ? s.inventory.quantity : "null"} ` +
          `bookingServices=${bs} invTx=${it} poItems=${po} rentalItems=${ri}`
      );
    }
  }

  console.log(`\nCó bản ghi nào bị tham chiếu không: ${anyReferenced}`);
}

main()
  .catch((e) => {
    console.error("ERROR:", e);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
