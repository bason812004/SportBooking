import { prisma } from "../config/db.js";

const PARTNER_ID = "pp0001";
const DEFAULT_QUANTITY = 50;
const DEFAULT_MIN_STOCK = 5;

async function main() {
  const services = await prisma.service.findMany({
    where: { partnerId: PARTNER_ID, type: "PRODUCT", trackInventory: true },
    include: { inventory: true }
  });

  const missing = services.filter((s) => !s.inventory);
  console.log(`Tạo tồn kho cho ${missing.length} dịch vụ đang thiếu...`);

  for (const s of missing) {
    await prisma.serviceInventory.create({
      data: {
        serviceId: s.id,
        quantity: DEFAULT_QUANTITY,
        minimumStock: DEFAULT_MIN_STOCK,
        unit: s.unit,
        lastPurchasePrice: s.costPrice
      }
    });
    console.log(`  [OK] ${s.name} -> ${DEFAULT_QUANTITY} ${s.unit}`);
  }

  console.log("Xong.");
}

main().finally(() => process.exit(0));
