import { prisma } from "../config/db.js";

export async function seedInventoryData() {
  console.log("=== BẮT ĐẦU SEED DỮ LIỆU SẢN PHẨM & TỒN KHO 50 ĐƠN VỊ ===");

  try {
    // 1. Ensure Categories exist
    const categories = [
      { name: "Đồ uống", slug: "do-uong", description: "Các loại nước giải khát, nước suối, nước tăng lực, bù khoáng" },
      { name: "Đồ ăn", slug: "do-an", description: "Bánh mì, bánh ngọt, đồ ăn nhẹ, mì cốc" },
      { name: "Trái cây", slug: "trai-cay", description: "Trái cây tươi đóng hộp ướp lạnh" },
      { name: "Phụ kiện thể thao", slug: "dung-cu-the-thao", description: "Bóng, cầu lông, vớ, khăn tập, băng trán" },
      { name: "Cho thuê dụng cụ", slug: "cho-thue-dung-cu", description: "Cho thuê vợt Tennis, Cầu lông, Pickleball" },
      { name: "Combo thể thao", slug: "combo-the-thao", description: "Các gói Combo tiết kiệm cho cá nhân và nhóm/đội" },
      { name: "Dịch vụ khác", slug: "dich-vu-khac", description: "Các dịch vụ tiện ích bổ sung tại sân" }
    ];

    for (const cat of categories) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO service_categories (id, name, slug, description, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
         ON CONFLICT (slug) DO NOTHING;`,
        cat.name, cat.slug, cat.description
      ).catch(() => {});
    }

    const catRows: any = await prisma.$queryRawUnsafe(`SELECT id, slug FROM service_categories;`).catch(() => []);
    const catMap = new Map<string, string>();
    if (Array.isArray(catRows)) {
      for (const r of catRows) {
        catMap.set(r.slug, r.id);
      }
    }

    // 2. Fetch all Partner IDs
    const partnerRows: any = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT partner_id as pid FROM courts WHERE partner_id IS NOT NULL AND partner_id != ''
      UNION
      SELECT id as pid FROM users WHERE role = 'PARTNER'
      UNION SELECT 'partner_01' as pid UNION SELECT 'p0001' as pid;
    `).catch(() => [{ pid: "p0001" }]);

    const partnerIds: string[] = Array.isArray(partnerRows)
      ? partnerRows.map((r: any) => r.pid).filter(Boolean)
      : ["p0001"];

    // 3. Define 20+ realistic sample products
    const sampleProducts = [
      // DRINK
      { name: "Coca Cola 330ml", categorySlug: "do-uong", type: "PRODUCT", price: 12000, costPrice: 7000, unit: "lon" },
      { name: "Pepsi Vị Chanh 330ml", categorySlug: "do-uong", type: "PRODUCT", price: 12000, costPrice: 7000, unit: "lon" },
      { name: "7Up Vị Chanh 330ml", categorySlug: "do-uong", type: "PRODUCT", price: 12000, costPrice: 7000, unit: "lon" },
      { name: "Sting Dâu Đỏ 330ml", categorySlug: "do-uong", type: "PRODUCT", price: 12000, costPrice: 7000, unit: "chai" },
      { name: "Nước suối Aquafina 500ml", categorySlug: "do-uong", type: "PRODUCT", price: 10000, costPrice: 5000, unit: "chai" },
      { name: "Revive Chanh Muối 500ml", categorySlug: "do-uong", type: "PRODUCT", price: 15000, costPrice: 8000, unit: "chai" },
      { name: "Pocari Sweat Bù Khoáng 500ml", categorySlug: "do-uong", type: "PRODUCT", price: 15000, costPrice: 9000, unit: "chai" },
      { name: "Redbull (Bò Húc Thái)", categorySlug: "do-uong", type: "PRODUCT", price: 18000, costPrice: 10000, unit: "lon" },
      { name: "Trà Đào Cam Sả Tươi", categorySlug: "do-uong", type: "PRODUCT", price: 25000, costPrice: 12000, unit: "ly" },

      // FOOD
      { name: "Bánh Mì Chả Pate", categorySlug: "do-an", type: "PRODUCT", price: 20000, costPrice: 12000, unit: "ổ" },
      { name: "Bánh Mì Ốp La 2 Trứng", categorySlug: "do-an", type: "PRODUCT", price: 25000, costPrice: 13000, unit: "ổ" },
      { name: "Bánh Ngọt Croissant Bơ Tươi", categorySlug: "do-an", type: "PRODUCT", price: 22000, costPrice: 12000, unit: "cái" },
      { name: "Gói Snack Lay's Vị Tự Nhiên", categorySlug: "do-an", type: "PRODUCT", price: 15000, costPrice: 9000, unit: "gói" },
      { name: "Mì Cốc Hảo Hảo Tôm Chua Cay", categorySlug: "do-an", type: "PRODUCT", price: 15000, costPrice: 8000, unit: "cốc" },

      // FRUIT
      { name: "Hộp Dưa Hấu Ướp Lạnh", categorySlug: "trai-cay", type: "PRODUCT", price: 25000, costPrice: 12000, unit: "hộp" },
      { name: "Hộp Xoài Lắc Muối Ớt", categorySlug: "trai-cay", type: "PRODUCT", price: 25000, costPrice: 12000, unit: "hộp" },
      { name: "Hộp Ổi Giòn Ngọt", categorySlug: "trai-cay", type: "PRODUCT", price: 20000, costPrice: 10000, unit: "hộp" },
      { name: "Chuối Sứ Thể Thao", categorySlug: "trai-cay", type: "PRODUCT", price: 8000, costPrice: 4000, unit: "quả" },

      // SPORT_EQUIPMENT / ACCESSORIES
      { name: "Quả Cầu Lông Thành Công (Hộp 12)", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 250000, costPrice: 180000, unit: "hộp" },
      { name: "Bóng Pickleball Franklin X-40", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 85000, costPrice: 55000, unit: "quả" },
      { name: "Bóng Tennis Wilson US Open", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 110000, costPrice: 75000, unit: "hộp" },
      { name: "Vớ Thể Thao Cổ Cao Yonex", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 35000, costPrice: 20000, unit: "đôi" },
      { name: "Khăn Bông Tắm Thể Thao", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 45000, costPrice: 25000, unit: "cái" },

      // RENTAL
      { name: "Cho Thuê Vợt Cầu Lông Cao Cấp", categorySlug: "cho-thue-dung-cu", type: "RENTAL_SERVICE", price: 50000, costPrice: 10000, unit: "lượt" },
      { name: "Cho Thuê Vợt Tennis Babolat", categorySlug: "cho-thue-dung-cu", type: "RENTAL_SERVICE", price: 100000, costPrice: 20000, unit: "lượt" },
      { name: "Cho Thuê Vợt Pickleball Selkirk", categorySlug: "cho-thue-dung-cu", type: "RENTAL_SERVICE", price: 80000, costPrice: 15000, unit: "lượt" }
    ];

    let insertedCount = 0;

    for (const pid of partnerIds) {
      for (const prod of sampleProducts) {
        const categoryId = catMap.get(prod.categorySlug) || null;

        // Find existing service first — avoids creating a duplicate on every server restart
        // (there is no unique constraint on (partner_id, name), so ON CONFLICT never matches).
        const existing: any = await prisma.$queryRawUnsafe(
          `SELECT id FROM services WHERE partner_id = $1 AND name = $2 LIMIT 1;`,
          pid, prod.name
        ).catch(() => []);

        let serviceId: string | null = Array.isArray(existing) && existing.length > 0 ? existing[0].id : null;

        if (!serviceId) {
          const serviceRows: any = await prisma.$queryRawUnsafe(
            `INSERT INTO services (id, partner_id, category_id, name, type, price, cost_price, unit, status, track_inventory, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, CASE WHEN $2::text IS NULL OR $2::text = '' THEN NULL ELSE $2::uuid END, $3, $4, $5, $6, $7, 'ACTIVE', TRUE, NOW(), NOW())
             RETURNING id;`,
            pid, categoryId, prod.name, prod.type, prod.price, prod.costPrice, prod.unit
          ).catch(() => []);
          if (Array.isArray(serviceRows) && serviceRows.length > 0) {
            serviceId = serviceRows[0].id;
          }
        }

        if (serviceId) {
          // Only set the initial stock when the inventory row doesn't exist yet.
          // Never touch quantity on an existing row — it would silently undo real sales on every dev restart.
          await prisma.$executeRawUnsafe(
            `INSERT INTO service_inventories (id, service_id, quantity, reserved_quantity, minimum_stock, unit, last_purchase_price, created_at, updated_at)
             VALUES (gen_random_uuid(), $1::uuid, 50, 0, 5, $2, $3, NOW(), NOW())
             ON CONFLICT (service_id) DO NOTHING;`,
            serviceId, prod.unit, prod.costPrice
          ).catch(() => {});

          insertedCount++;
        }
      }
    }

    // 4. Map services to all courts in court_services
    const courts: any = await prisma.$queryRawUnsafe(`SELECT id, partner_id FROM courts;`).catch(() => []);
    const services: any = await prisma.$queryRawUnsafe(`SELECT id, partner_id, name, price FROM services;`).catch(() => []);

    if (Array.isArray(courts) && Array.isArray(services)) {
      for (const court of courts) {
        const courtSvcs = services.filter((s: any) => s.partner_id === court.partner_id || !s.partner_id);
        const svcsToLink = courtSvcs.length > 0 ? courtSvcs : services.slice(0, 30);

        for (const svc of svcsToLink) {
          const customId = `cs_${court.id}_${svc.id.slice(0, 8)}`;
          await prisma.$executeRawUnsafe(
            `INSERT INTO court_services (id, court_id, service_id, name, price, is_available, status, created_at, updated_at)
             VALUES ($1, $2, $3::uuid, $4, $5, TRUE, 'ACTIVE', NOW(), NOW())
             ON CONFLICT (id) DO UPDATE SET price = EXCLUDED.price, status = 'ACTIVE';`,
            customId, court.id, svc.id, svc.name, svc.price
          ).catch(() => {});
        }
      }
    }

    console.log(`=== ĐÃ HOÀN THÀNH SEED DỮ LIỆU SẢN PHẨM & TỒN KHO (TỔNG SỐ THIẾT LẬP: ${insertedCount}) ===`);
  } catch (err) {
    console.error("seedInventoryData error:", err);
  }
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
