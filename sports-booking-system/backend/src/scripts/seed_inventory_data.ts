import { forceSeedAllServicesToDb } from "../modules/services/service.repository.js";

export async function seedInventoryData() {
  console.log("=== BẮT ĐẦU SEED & CHIA ĐỀU DỊCH VỤ / TỒN KHO CHO CÁC CỤM SÂN (COURTS) ===");
  await forceSeedAllServicesToDb();
  console.log("=== ĐÃ HOÀN THÀNH SEED VÀ PHÂN BỔ DỊCH VỤ THEO COURT ID ===");
}

// Execute directly if run via CLI
if (process.argv[1]?.includes("seed_inventory_data")) {
  seedInventoryData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
