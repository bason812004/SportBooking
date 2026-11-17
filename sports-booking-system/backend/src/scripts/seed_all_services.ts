import { prisma } from "../config/db.js";
import { detectSportFromText } from "../modules/services/service.repository.js";

/**
 * Fills courts that sell nothing yet with a sample catalog (drinks, food, gear and the court's sport items, 50 in
 * stock each) for demos. Run by hand only; the app never seeds services on its own any more. A court that already
 * has any service row is skipped, and nothing is ever deleted.
 *
 *   npx tsx src/scripts/seed_all_services.ts --court=c0001,c0002
 *
 * `--court` is required on purpose: Windows PowerShell drops the `--` in `npm run seed:services -- --court=...`,
 * and a silent default would write sample products to courts nobody chose.
 */

const courtArg = process.argv.find((arg) => arg.startsWith("--court="));
const courtIds = courtArg ? courtArg.slice("--court=".length).split(",").map((id) => id.trim()).filter(Boolean) : [];

async function seedCourt(courtId: string): Promise<string> {
  const courtRows: any = await prisma.$queryRawUnsafe(
    `SELECT c.id, c.partner_id as "partnerId", c.name, cat.name as "categoryName", cat.slug as "categorySlug",
            (SELECT COUNT(*)::int FROM services s WHERE s.court_id = c.id) as "serviceCount"
     FROM courts c
     LEFT JOIN court_categories cat ON c.category_id = cat.id
     WHERE c.id = $1 LIMIT 1;`,
    courtId
  );
  const court = Array.isArray(courtRows) ? courtRows[0] : null;
  if (!court) return "không tìm thấy sân";
  if (court.serviceCount > 0) return `bỏ qua, sân đã có ${court.serviceCount} dịch vụ`;

  const partnerId = court.partnerId;
  const fullText = `${String(court.name || "").toLowerCase()} ${String(court.categoryName || "")} ${String(court.categorySlug || "")}`;
  const { isBadminton, isTennis, isPickleball, isFootball, isBasketball, isVolleyball } = detectSportFromText(fullText);

  const masterServices = [
    // Drinks
    { name: "Nước suối Aquafina 500ml", categorySlug: "do-uong", type: "PRODUCT", price: 10000, costPrice: 4000, unit: "chai", imageUrl: "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=60" },
    { name: "Coca Cola 330ml", categorySlug: "do-uong", type: "PRODUCT", price: 12000, costPrice: 7000, unit: "lon", imageUrl: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=60" },
    { name: "Pocari Sweat Bù Khoáng 500ml", categorySlug: "do-uong", type: "PRODUCT", price: 15000, costPrice: 9000, unit: "chai", imageUrl: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&auto=format&fit=crop&q=60" },
    { name: "Redbull (Bò Húc Thái)", categorySlug: "do-uong", type: "PRODUCT", price: 18000, costPrice: 10000, unit: "lon", imageUrl: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500&auto=format&fit=crop&q=60" },
    { name: "Revive Chanh Muối 500ml", categorySlug: "do-uong", type: "PRODUCT", price: 15000, costPrice: 8000, unit: "chai", imageUrl: "https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?w=500&auto=format&fit=crop&q=60" },

    // Fresh Fruit
    { name: "Hộp Dưa Hấu Ướp Lạnh", categorySlug: "trai-cay", type: "PRODUCT", price: 25000, costPrice: 12000, unit: "hộp", imageUrl: "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=500&auto=format&fit=crop&q=60" },
    { name: "Chuối Sứ Thể Thao", categorySlug: "trai-cay", type: "PRODUCT", price: 8000, costPrice: 4000, unit: "quả", imageUrl: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=500&auto=format&fit=crop&q=60" },

    // Food & Snacks
    { name: "Bánh Mì Chả Pate", categorySlug: "do-an", type: "PRODUCT", price: 20000, costPrice: 11000, unit: "ổ", imageUrl: "https://images.unsplash.com/photo-1626074353765-517a681e40be?w=500&auto=format&fit=crop&q=60" },
    { name: "Mì Ly Cung Đình Bò Hầm", categorySlug: "do-an", type: "PRODUCT", price: 15000, costPrice: 8000, unit: "ly", imageUrl: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&auto=format&fit=crop&q=60" },
    { name: "Bánh Bao Nhân Thịt Trứng Cút", categorySlug: "do-an", type: "PRODUCT", price: 18000, costPrice: 10000, unit: "cái", imageUrl: "https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?w=500&auto=format&fit=crop&q=60" },

    // Common Gear
    { name: "Khăn Lạnh Ướp Hương", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 5000, costPrice: 2000, unit: "cái", imageUrl: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=500&auto=format&fit=crop&q=60" },
    { name: "Khăn Bông Thấm Mồ Hôi 100% Cotton", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 35000, costPrice: 18000, unit: "cái", imageUrl: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=500&auto=format&fit=crop&q=60" },

    // 🎾 1. BADMINTON (Cầu lông - Có thuê vợt)
    ...(isBadminton ? [
      { name: "Thuê Vợt Cầu Lông Yonex Astrox", categorySlug: "cho-thue-dung-cu", type: "RENTAL_SERVICE", price: 40000, costPrice: 0, unit: "lượt", imageUrl: "https://images.unsplash.com/photo-1613918108466-292b78a8ef95?w=500&auto=format&fit=crop&q=60" },
      { name: "Cho Thuê Vợt Cầu Lông Cao Cấp", categorySlug: "cho-thue-dung-cu", type: "RENTAL_SERVICE", price: 50000, costPrice: 10000, unit: "lượt", imageUrl: "https://images.unsplash.com/photo-1613918108466-292b78a8ef95?w=500&auto=format&fit=crop&q=60" },
      { name: "Cầu Lông Ba Sao Đỏ (Ống 12 quả)", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 240000, costPrice: 170000, unit: "ống", imageUrl: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=500&auto=format&fit=crop&q=60" },
      { name: "Quả Cầu Lông Thành Công (Hộp 12)", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 250000, costPrice: 180000, unit: "hộp", imageUrl: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=500&auto=format&fit=crop&q=60" },
      { name: "Quấn Cán Vợt Cầu Lông Yonex", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 20000, costPrice: 8000, unit: "cái", imageUrl: "https://images.unsplash.com/photo-1613918108466-292b78a8ef95?w=500&auto=format&fit=crop&q=60" },
      { name: "Vớ Thể Thao Yonex Chống Trượt", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 30000, costPrice: 15000, unit: "đôi", imageUrl: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=500&auto=format&fit=crop&q=60" }
    ] : []),

    // 🎾 2. TENNIS (Tennis - Có thuê vợt)
    ...(isTennis ? [
      { name: "Thuê Vợt Tennis Wilson Pro", categorySlug: "cho-thue-dung-cu", type: "RENTAL_SERVICE", price: 80000, costPrice: 0, unit: "lượt", imageUrl: "https://images.unsplash.com/photo-1617083934555-563d9178ee72?w=500&auto=format&fit=crop&q=60" },
      { name: "Cho Thuê Vợt Tennis Babolat", categorySlug: "cho-thue-dung-cu", type: "RENTAL_SERVICE", price: 100000, costPrice: 20000, unit: "lượt", imageUrl: "https://images.unsplash.com/photo-1617083934555-563d9178ee72?w=500&auto=format&fit=crop&q=60" },
      { name: "Bóng Tennis Wilson (Hộp 3 quả)", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 95000, costPrice: 65000, unit: "hộp", imageUrl: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=500&auto=format&fit=crop&q=60" },
      { name: "Bóng Tennis Wilson US Open", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 110000, costPrice: 75000, unit: "hộp", imageUrl: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=500&auto=format&fit=crop&q=60" },
      { name: "Quấn Cán Vợt Tennis Babolat", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 25000, costPrice: 10000, unit: "cái", imageUrl: "https://images.unsplash.com/photo-1617083934555-563d9178ee72?w=500&auto=format&fit=crop&q=60" },
      { name: "Vớ Thể Thao Tennis Cotton", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 35000, costPrice: 18000, unit: "đôi", imageUrl: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=500&auto=format&fit=crop&q=60" }
    ] : []),

    // 🎾 3. PICKLEBALL (Pickleball - Có thuê vợt)
    ...(isPickleball ? [
      { name: "Thuê Vợt Pickleball Selkirk", categorySlug: "cho-thue-dung-cu", type: "RENTAL_SERVICE", price: 60000, costPrice: 0, unit: "lượt", imageUrl: "https://images.unsplash.com/photo-1688649475459-71583d735079?w=500&auto=format&fit=crop&q=60" },
      { name: "Cho Thuê Vợt Pickleball Franklin", categorySlug: "cho-thue-dung-cu", type: "RENTAL_SERVICE", price: 50000, costPrice: 10000, unit: "lượt", imageUrl: "https://images.unsplash.com/photo-1688649475459-71583d735079?w=500&auto=format&fit=crop&q=60" },
      { name: "Bóng Pickleball Franklin X-40", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 45000, costPrice: 28000, unit: "quả", imageUrl: "https://images.unsplash.com/photo-1688649475459-71583d735079?w=500&auto=format&fit=crop&q=60" },
      { name: "Bóng Pickleball Diadem (Hộp 3 quả)", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 120000, costPrice: 80000, unit: "hộp", imageUrl: "https://images.unsplash.com/photo-1688649475459-71583d735079?w=500&auto=format&fit=crop&q=60" },
      { name: "Vớ Thể Thao Pickleball Chống Trượt", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 30000, costPrice: 15000, unit: "đôi", imageUrl: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=500&auto=format&fit=crop&q=60" }
    ] : []),

    // ⚽ 4. FOOTBALL (Bóng đá - Không thuê vợt!)
    ...(isFootball ? [
      { name: "Cho Thuê Bóng Đá Động Lực Số 5", categorySlug: "cho-thue-dung-cu", type: "RENTAL_SERVICE", price: 30000, costPrice: 0, unit: "trận", imageUrl: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=500&auto=format&fit=crop&q=60" },
      { name: "Băng Bọc Ống Quyển Chống Chấn Thương", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 45000, costPrice: 22000, unit: "cặp", imageUrl: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=500&auto=format&fit=crop&q=60" },
      { name: "Vớ Đá Bóng Cổ Cao Dày 100% Cotton", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 35000, costPrice: 16000, unit: "đôi", imageUrl: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=500&auto=format&fit=crop&q=60" },
      { name: "Vớ Chống Trượt Đá Bóng Fox-Socks", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 40000, costPrice: 20000, unit: "đôi", imageUrl: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=500&auto=format&fit=crop&q=60" },
      { name: "Thuê Bộ 10 Áo Bít Phân Đội Đá Bóng", categorySlug: "cho-thue-dung-cu", type: "RENTAL_SERVICE", price: 50000, costPrice: 10000, unit: "bộ", imageUrl: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=500&auto=format&fit=crop&q=60" }
    ] : []),

    // 🏀 5. BASKETBALL (Bóng rổ - Không thuê vợt!)
    ...(isBasketball ? [
      { name: "Cho Thuê Bóng Rổ Molten Da Thật", categorySlug: "cho-thue-dung-cu", type: "RENTAL_SERVICE", price: 30000, costPrice: 0, unit: "lượt", imageUrl: "https://images.unsplash.com/photo-1519766304817-4f37bda74a29?w=500&auto=format&fit=crop&q=60" },
      { name: "Băng Bọc Cổ Tay & Ngón Tay Thể Thao", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 20000, costPrice: 9000, unit: "cái", imageUrl: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop&q=60" },
      { name: "Vớ Bóng Rổ Cổ Cao Đệm Dày Chống Trượt", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 40000, costPrice: 18000, unit: "đôi", imageUrl: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=500&auto=format&fit=crop&q=60" },
      { name: "Băng Đệm Bảo Vệ Đầu Gối / Khuỷu Tay", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 50000, costPrice: 25000, unit: "cặp", imageUrl: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop&q=60" }
    ] : []),

    // 🏐 6. VOLLEYBALL (Bóng chuyền - Không thuê vợt!)
    ...(isVolleyball ? [
      { name: "Cho Thuê Bóng Chuyền Mikasa Da Thật", categorySlug: "cho-thue-dung-cu", type: "RENTAL_SERVICE", price: 30000, costPrice: 0, unit: "lượt", imageUrl: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=500&auto=format&fit=crop&q=60" },
      { name: "Băng Đệm Bảo Vệ Đầu Gối Thi Đấu", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 60000, costPrice: 30000, unit: "cặp", imageUrl: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=500&auto=format&fit=crop&q=60" },
      { name: "Băng Bảo Vệ Cổ Tay / Cánh Tay", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 35000, costPrice: 16000, unit: "cặp", imageUrl: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=500&auto=format&fit=crop&q=60" },
      { name: "Vớ Thể Thao Chuyên Dụng Thi Đấu", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 30000, costPrice: 15000, unit: "đôi", imageUrl: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=500&auto=format&fit=crop&q=60" }
    ] : []),

    // Combos
    { name: "Combo Đôi Năng Lượng (2 Suối + 1 Dưa Hấu + 2 Khăn)", categorySlug: "combo-the-thao", type: "PRODUCT", price: 45000, costPrice: 22000, unit: "combo", imageUrl: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop&q=60" },
    { name: "Combo Team 4 Đập Phá (4 Nước Ngọt + 1 Đĩa Trái Cây + 4 Khăn)", categorySlug: "combo-the-thao", type: "PRODUCT", price: 110000, costPrice: 58000, unit: "combo", imageUrl: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop&q=60" }
  ];

  const catRows: any = await prisma.$queryRawUnsafe(`SELECT id, slug FROM service_categories;`).catch(() => []);
  const catMap = new Map<string, string>();
  if (Array.isArray(catRows)) {
    for (const r of catRows) catMap.set(r.slug, r.id);
  }

  let seeded = 0;
  for (const svc of masterServices) {
    const categoryId = catMap.get(svc.categorySlug) || null;
    const res: any = await prisma.$queryRawUnsafe(
      `INSERT INTO services (id, partner_id, court_id, category_id, name, description, type, price, cost_price, unit, image_url, status, track_inventory, created_at, updated_at)
       VALUES (DEFAULT, $1, $2, $3::uuid, $4, $5, $6, $7, $8, $9, $10, 'ACTIVE', true, NOW(), NOW())
       ON CONFLICT DO NOTHING
       RETURNING id;`,
      partnerId, courtId, categoryId, svc.name, `${svc.name} phục vụ tại ${court.name}`, svc.type, svc.price, svc.costPrice, svc.unit, svc.imageUrl || null
    ).catch(() => []);

    let serviceId = Array.isArray(res) && res.length > 0 && res[0].id ? res[0].id : null;
    if (!serviceId) {
      const existRows: any = await prisma.$queryRawUnsafe(
        `SELECT id FROM services WHERE court_id = $1 AND name = $2 LIMIT 1;`,
        courtId, svc.name
      ).catch(() => []);
      if (Array.isArray(existRows) && existRows.length > 0) {
        serviceId = existRows[0].id;
        if (svc.imageUrl) {
          await prisma.$executeRawUnsafe(
            `UPDATE services SET image_url = $1 WHERE id = $2 AND (image_url IS NULL OR image_url = '');`,
            svc.imageUrl, serviceId
          ).catch(() => {});
        }
      }
    }

    if (serviceId) {
      seeded += 1;
      await prisma.$executeRawUnsafe(
        `INSERT INTO service_inventories (id, service_id, quantity, reserved_quantity, minimum_stock, unit, last_purchase_price, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, 50, 0, 5, $2, $3, NOW(), NOW())
         ON CONFLICT (service_id) DO NOTHING;`,
        serviceId, svc.unit, svc.costPrice
      ).catch(() => {});
    }
  }
  return `đã thêm ${seeded} dịch vụ mẫu`;
}

async function main() {
  if (!courtIds.length) {
    console.error("Thiếu --court=<id,id,...>: chọn sân cần nạp dịch vụ mẫu.");
    process.exitCode = 1;
    return;
  }
  for (const courtId of courtIds) {
    console.log(`${courtId}: ${await seedCourt(courtId)}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
