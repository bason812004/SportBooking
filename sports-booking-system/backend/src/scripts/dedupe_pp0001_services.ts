import { prisma } from "../config/db.js";

const PARTNER_ID = "pp0001";

async function main() {
  const services = await prisma.service.findMany({
    where: { partnerId: PARTNER_ID },
    orderBy: { createdAt: "asc" }
  });

  const byName = new Map<string, typeof services>();
  for (const s of services) {
    const key = `${s.name}||${s.type}`;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(s);
  }

  const idsToDelete: string[] = [];
  for (const [key, arr] of byName) {
    if (arr.length <= 1) continue;
    const [keep, ...dupes] = arr;
    console.log(`${key}: giữ ${keep.id} (tạo ${keep.createdAt.toISOString()}), xoá ${dupes.map((d) => d.id).join(", ")}`);
    idsToDelete.push(...dupes.map((d) => d.id));
  }

  console.log(`\nTổng số bản ghi sẽ xoá: ${idsToDelete.length}`);
  if (idsToDelete.length === 0) return;

  const result = await prisma.service.deleteMany({ where: { id: { in: idsToDelete } } });
  console.log(`Đã xoá: ${result.count} dịch vụ (kèm inventory liên quan qua cascade).`);
}

main()
  .catch((e) => {
    console.error("ERROR:", e);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
