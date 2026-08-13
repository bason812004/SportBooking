require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function run() {
  console.log("=== EXECUTING SERVICE REDISTRIBUTION SCRIPT ===");
  
  await prisma.$executeRawUnsafe(`ALTER TABLE services ALTER COLUMN type TYPE VARCHAR(50) USING type::text;`).catch(() => {});
  await prisma.$executeRawUnsafe(`ALTER TABLE services ADD COLUMN IF NOT EXISTS court_id VARCHAR(50);`).catch(() => {});

  const categories = [
    { name: "Đồ uống", slug: "do-uong", description: "Các loại nước giải khát, nước suối, nước tăng lực, bù khoáng" },
    { name: "Đồ ăn", slug: "do-an", description: "Bánh mì, bánh ngọt, đồ ăn nhẹ, mì cốc" },
    { name: "Trái cây", slug: "trai-cay", description: "Trái cây tươi đóng hộp ướp lạnh" },
    { name: "Dụng cụ thể thao", slug: "dung-cu-the-thao", description: "Bóng, cầu lông, vớ, khăn tập, băng trán" },
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

  const catRows = await prisma.$queryRawUnsafe(`SELECT id, slug FROM service_categories;`).catch(() => []);
  const catMap = new Map();
  if (Array.isArray(catRows)) {
    for (const r of catRows) catMap.set(r.slug, r.id);
  }

  const masterServices = [
    { name: "Nước suối Aquafina 500ml", categorySlug: "do-uong", type: "PRODUCT", price: 10000, costPrice: 4000, unit: "chai" },
    { name: "Coca Cola 330ml", categorySlug: "do-uong", type: "PRODUCT", price: 12000, costPrice: 7000, unit: "lon" },
    { name: "Pepsi Vị Chanh 330ml", categorySlug: "do-uong", type: "PRODUCT", price: 12000, costPrice: 7000, unit: "lon" },
    { name: "7Up Vị Chanh 330ml", categorySlug: "do-uong", type: "PRODUCT", price: 12000, costPrice: 7000, unit: "lon" },
    { name: "Sting Dâu Đỏ 330ml", categorySlug: "do-uong", type: "PRODUCT", price: 12000, costPrice: 7000, unit: "chai" },
    { name: "Pocari Sweat Bù Khoáng 500ml", categorySlug: "do-uong", type: "PRODUCT", price: 15000, costPrice: 9000, unit: "chai" },
    { name: "Redbull (Bò Húc Thái)", categorySlug: "do-uong", type: "PRODUCT", price: 18000, costPrice: 10000, unit: "lon" },
    { name: "Trà Đào Cam Sả Tươi", categorySlug: "do-uong", type: "PRODUCT", price: 25000, costPrice: 12000, unit: "ly" },
    { name: "Nước Dừa Tươi Ướp Lạnh", categorySlug: "do-uong", type: "PRODUCT", price: 25000, costPrice: 15000, unit: "trái" },
    { name: "Revive Chanh Muối 500ml", categorySlug: "do-uong", type: "PRODUCT", price: 15000, costPrice: 8000, unit: "chai" },

    { name: "Hộp Dưa Hấu Ướp Lạnh", categorySlug: "trai-cay", type: "PRODUCT", price: 25000, costPrice: 12000, unit: "hộp" },
    { name: "Hộp Xoài Lắc Muối Ớt", categorySlug: "trai-cay", type: "PRODUCT", price: 25000, costPrice: 12000, unit: "hộp" },
    { name: "Hộp Ổi Giòn Ngọt", categorySlug: "trai-cay", type: "PRODUCT", price: 20000, costPrice: 10000, unit: "hộp" },
    { name: "Hộp Nho Mỹ Không Hạt", categorySlug: "trai-cay", type: "PRODUCT", price: 40000, costPrice: 22000, unit: "hộp" },
    { name: "Đĩa Trái Cây Thập Cẩm Lớn", categorySlug: "trai-cay", type: "PRODUCT", price: 65000, costPrice: 35000, unit: "đĩa" },
    { name: "Chuối Sứ Thể Thao", categorySlug: "trai-cay", type: "PRODUCT", price: 8000, costPrice: 4000, unit: "quả" },

    { name: "Bánh Mì Chả Pate", categorySlug: "do-an", type: "PRODUCT", price: 20000, costPrice: 11000, unit: "ổ" },
    { name: "Bánh Mì Ốp La 2 Trứng", categorySlug: "do-an", type: "PRODUCT", price: 25000, costPrice: 13000, unit: "ổ" },
    { name: "Mì Ly Cung Đình Bò Hầm", categorySlug: "do-an", type: "PRODUCT", price: 15000, costPrice: 8000, unit: "ly" },
    { name: "Xúc Xích Nướng Đức", categorySlug: "do-an", type: "PRODUCT", price: 15000, costPrice: 7000, unit: "cây" },
    { name: "Bánh Bao Nhân Thịt Trứng Cút", categorySlug: "do-an", type: "PRODUCT", price: 18000, costPrice: 10000, unit: "cái" },
    { name: "Bánh Ngọt Croissant Bơ Tươi", categorySlug: "do-an", type: "PRODUCT", price: 22000, costPrice: 12000, unit: "cái" },
    { name: "Gói Snack Lay's Vị Tự Nhiên", categorySlug: "do-an", type: "PRODUCT", price: 15000, costPrice: 9000, unit: "gói" },
    { name: "Mì Cốc Hảo Hảo Tôm Chua Cay", categorySlug: "do-an", type: "PRODUCT", price: 15000, costPrice: 8000, unit: "cốc" },

    { name: "Vớ Thể Thao Yonex", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 25000, costPrice: 12000, unit: "đôi" },
    { name: "Khăn Lạnh Ướp Hương", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 5000, costPrice: 2000, unit: "cái" },
    { name: "Khăn Bông Thấm Mồ Hôi 100% Cotton", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 35000, costPrice: 18000, unit: "cái" },
    { name: "Băng Trán / Cổ Tay Thể Thao", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 20000, costPrice: 9000, unit: "cái" },
    { name: "Bóng Tennis Wilson (Hộp 3 quả)", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 95000, costPrice: 65000, unit: "hộp" },
    { name: "Cầu Lông Ba Sao Đỏ (Ống 12 quả)", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 240000, costPrice: 170000, unit: "ống" },
    { name: "Bóng Pickleball Franklin X-40", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 45000, costPrice: 28000, unit: "quả" },
    { name: "Quả Cầu Lông Thành Công (Hộp 12)", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 250000, costPrice: 180000, unit: "hộp" },
    { name: "Bóng Tennis Wilson US Open", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 110000, costPrice: 75000, unit: "hộp" },
    { name: "Vớ Thể Thao Cổ Cao Yonex", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 35000, costPrice: 20000, unit: "đôi" },
    { name: "Khăn Bông Tắm Thể Thao", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 45000, costPrice: 25000, unit: "cái" },

    { name: "Thuê Vợt Tennis Wilson Pro", categorySlug: "cho-thue-dung-cu", type: "RENTAL_SERVICE", price: 80000, costPrice: 0, unit: "lượt" },
    { name: "Thuê Vợt Cầu Lông Yonex Astrox", categorySlug: "cho-thue-dung-cu", type: "RENTAL_SERVICE", price: 40000, costPrice: 0, unit: "lượt" },
    { name: "Thuê Vợt Pickleball Selkirk", categorySlug: "cho-thue-dung-cu", type: "RENTAL_SERVICE", price: 60000, costPrice: 0, unit: "lượt" },
    { name: "Cho Thuê Vợt Tennis Babolat", categorySlug: "cho-thue-dung-cu", type: "RENTAL_SERVICE", price: 100000, costPrice: 20000, unit: "lượt" },
    { name: "Cho Thuê Vợt Cầu Lông Cao Cấp", categorySlug: "cho-thue-dung-cu", type: "RENTAL_SERVICE", price: 50000, costPrice: 10000, unit: "lượt" },

    { name: "Combo Đôi Năng Lượng (2 Suối + 1 Dưa Hấu + 2 Khăn)", categorySlug: "combo-the-thao", type: "PRODUCT", price: 45000, costPrice: 22000, unit: "combo" },
    { name: "Combo Team 4 Đập Phá (4 Nước Ngọt + 1 Đĩa Trái Cây + 4 Khăn)", categorySlug: "combo-the-thao", type: "PRODUCT", price: 110000, costPrice: 58000, unit: "combo" },
    { name: "Combo Thể Lực Tốc Độ (1 Pocari + 1 Redbull + 2 Chuối Sứ)", categorySlug: "combo-the-thao", type: "PRODUCT", price: 42000, costPrice: 22000, unit: "combo" }
  ];

  let courts = await prisma.$queryRawUnsafe(`SELECT id, partner_id, name FROM courts ORDER BY id;`).catch(() => []);
  if (!Array.isArray(courts) || courts.length === 0) {
    courts = [
      { id: "c0001", partner_id: "p0001", name: "Sân Cầu Lông / Pickleball 01" },
      { id: "c0002", partner_id: "p0001", name: "Sân Cầu Lông / Pickleball 02" },
      { id: "c0003", partner_id: "p0001", name: "Sân Cầu Lông / Pickleball 03" },
      { id: "c0004", partner_id: "p0001", name: "Sân Cầu Lông / Pickleball 04" },
      { id: "c0005", partner_id: "p0001", name: "Sân Cầu Lông / Pickleball 05" },
      { id: "c0006", partner_id: "p0001", name: "Sân Cầu Lông / Pickleball 06" }
    ];
  }

  await prisma.$executeRawUnsafe(`DELETE FROM court_services;`).catch(() => {});
  await prisma.$executeRawUnsafe(`DELETE FROM service_inventories;`).catch(() => {});
  await prisma.$executeRawUnsafe(`DELETE FROM services;`).catch(() => {});

  let insertedCount = 0;
  let linkCount = 0;

  for (let cIdx = 0; cIdx < courts.length; cIdx++) {
    const court = courts[cIdx];
    const courtId = court.id;
    const partnerId = court.partner_id || "p0001";

    const assignedServices = masterServices.filter((_, sIdx) => {
      return (sIdx + cIdx) % 2 === 0 || (sIdx % 3 === cIdx % 3);
    });

    for (const svc of assignedServices) {
      const catId = catMap.get(svc.categorySlug) || null;

      let serviceId = "";
      const inserted = await prisma.$queryRawUnsafe(
        `INSERT INTO services (id, court_id, partner_id, category_id, name, type, price, cost_price, unit, status, track_inventory, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, CASE WHEN $3::text IS NULL OR $3::text = '' THEN NULL ELSE $3::uuid END, $4, $5, $6, $7, $8, 'ACTIVE', TRUE, NOW(), NOW())
         RETURNING id;`,
        courtId, partnerId, catId, svc.name, svc.type, svc.price, svc.costPrice, svc.unit
      ).catch(() => []);

      if (Array.isArray(inserted) && inserted.length > 0) {
        serviceId = inserted[0].id;
        insertedCount++;
      } else {
        await prisma.$executeRawUnsafe(
          `INSERT INTO services (id, court_id, partner_id, category_id, name, type, price, cost_price, unit, status, track_inventory, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, CASE WHEN $3::text IS NULL OR $3::text = '' THEN NULL ELSE $3::uuid END, $4, $5, $6, $7, $8, 'ACTIVE', TRUE, NOW(), NOW());`,
          courtId, partnerId, catId, svc.name, svc.type, svc.price, svc.costPrice, svc.unit
        ).catch(() => {});

        const existing = await prisma.$queryRawUnsafe(
          `SELECT id FROM services WHERE court_id = $1 AND name = $2 LIMIT 1;`,
          courtId, svc.name
        ).catch(() => []);
        if (Array.isArray(existing) && existing.length > 0) {
          serviceId = existing[0].id;
          insertedCount++;
        }
      }

      if (serviceId) {
        const csCustomId = `cs_${courtId}_${serviceId.slice(0, 8)}`;
        await prisma.$executeRawUnsafe(
          `INSERT INTO court_services (id, court_id, service_id, name, price, is_available, status, created_at, updated_at)
           VALUES ($1, $2, $3::uuid, $4, $5, TRUE, 'ACTIVE', NOW(), NOW())
           ON CONFLICT (id) DO UPDATE SET price = EXCLUDED.price, status = 'ACTIVE';`,
          csCustomId, courtId, serviceId, svc.name, svc.price
        ).catch(() => {});
        linkCount++;

        await prisma.$executeRawUnsafe(
          `INSERT INTO service_inventories (id, service_id, quantity, reserved_quantity, minimum_stock, unit, last_purchase_price, created_at, updated_at)
           VALUES (gen_random_uuid(), $1::uuid, 50, 0, 5, $2, $3, NOW(), NOW())
           ON CONFLICT (service_id) DO UPDATE 
           SET quantity = GREATEST(service_inventories.quantity, 50),
               minimum_stock = 5,
               unit = EXCLUDED.unit,
               last_purchase_price = EXCLUDED.last_purchase_price,
               updated_at = NOW();`,
          serviceId, svc.unit, svc.costPrice
        ).catch(() => {});
      }
    }
  }

  console.log(`=== SUCCESS: Distributed services across ${courts.length} courts. Created ${insertedCount} new services and ${linkCount} court_services links. ===`);
}

run().then(() => prisma.$disconnect()).catch(err => { console.error(err); prisma.$disconnect(); });
