import crypto from "crypto";
import { prisma } from "../../config/db.js";
import type { CreateServiceCategoryInput, CreateServiceInput, UpdateServiceInput } from "./service.types.js";

let tablesReady = false;
let isInitializing = false;

export async function ensureServiceTables() {
  if (tablesReady) return;
  if (isInitializing) return;
  isInitializing = true;

  try {
    const statements = [
      `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`,
      `ALTER TABLE courts ADD COLUMN IF NOT EXISTS require_deposit BOOLEAN DEFAULT FALSE;`,
      `ALTER TABLE services ADD COLUMN IF NOT EXISTS court_id VARCHAR(50);`,
      `CREATE TABLE IF NOT EXISTS service_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );`,
      `CREATE TABLE IF NOT EXISTS services (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        partner_id VARCHAR(50) NOT NULL,
        category_id UUID REFERENCES service_categories(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(50) DEFAULT 'PRODUCT',
        sport_type VARCHAR(50),
        price DECIMAL(12, 2) NOT NULL DEFAULT 0,
        original_price DECIMAL(12, 2),
        cost_price DECIMAL(12, 2) DEFAULT 0,
        unit VARCHAR(20) DEFAULT 'lon',
        image_url TEXT,
        status VARCHAR(20) DEFAULT 'ACTIVE',
        track_inventory BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );`,
      `CREATE TABLE IF NOT EXISTS court_services (
        id VARCHAR(20) PRIMARY KEY,
        court_id VARCHAR(20) NOT NULL,
        service_id UUID REFERENCES services(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(12, 2) NOT NULL DEFAULT 0,
        price_override DECIMAL(12, 2),
        is_available BOOLEAN DEFAULT TRUE,
        status VARCHAR(20) DEFAULT 'ACTIVE',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );`,
      `ALTER TABLE booking_services ALTER COLUMN service_id TYPE VARCHAR(100);`,
      `ALTER TABLE booking_services ALTER COLUMN court_service_id TYPE VARCHAR(100);`,
      `ALTER TABLE booking_services DROP CONSTRAINT IF EXISTS booking_services_service_id_fkey;`,
      `CREATE INDEX IF NOT EXISTS idx_services_court_id ON services(court_id);`,
      `CREATE INDEX IF NOT EXISTS idx_court_services_court_id ON court_services(court_id);`
    ];

    for (const statement of statements) {
      await prisma.$executeRawUnsafe(statement).catch(() => {});
    }

    console.log("[ServiceRepository] Schema & categories checked/initialized.");
    tablesReady = true;
  } catch (err) {
    console.error("[ServiceRepository] Table setup warning:", err);
  } finally {
    isInitializing = false;
  }
}

export async function forceSeedAllServicesToDb() {
  try {
    console.log("[ServiceRepository] Starting clean service redistribution across courts...");
    
    // Ensure columns and types match
    await prisma.$executeRawUnsafe(`ALTER TABLE services ALTER COLUMN type TYPE VARCHAR(50) USING type::text;`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE services ADD COLUMN IF NOT EXISTS court_id VARCHAR(50);`).catch(() => {});

    // 1. Ensure categories exist
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

    // Master sample services pool
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

    // Fetch all courts
    let courts: any = await prisma.$queryRawUnsafe(`SELECT id, partner_id, name FROM courts ORDER BY id;`).catch(() => []);
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

    // Clean old duplicate records
    await prisma.$executeRawUnsafe(`DELETE FROM court_services;`).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM service_inventories;`).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM services;`).catch(() => {});

    let totalServicesSeeded = 0;
    let totalLinksSeeded = 0;

    // Distribute services evenly among courts
    for (let cIdx = 0; cIdx < courts.length; cIdx++) {
      const court = courts[cIdx];
      const courtId = court.id;
      const partnerId = court.partner_id || "p0001";

      const assignedServices = masterServices.filter((_, sIdx) => {
        return (sIdx + cIdx) % 2 === 0 || (sIdx % 3 === cIdx % 3);
      });

      for (const svc of assignedServices) {
        const catId = catMap.get(svc.categorySlug) ?? null;

        let serviceId = "";
        const inserted: any = await prisma.$queryRawUnsafe(
          `INSERT INTO services (id, court_id, partner_id, category_id, name, type, price, cost_price, unit, status, track_inventory, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, CASE WHEN $3::text IS NULL OR $3::text = '' THEN NULL ELSE $3::uuid END, $4, $5, $6, $7, $8, 'ACTIVE', TRUE, NOW(), NOW())
           RETURNING id;`,
          courtId, partnerId, catId, svc.name, svc.type, svc.price, svc.costPrice, svc.unit
        ).catch(async (err) => {
          console.error("[ServiceRepository] Direct insert error:", err);
          return [];
        });

        if (Array.isArray(inserted) && inserted.length > 0) {
          serviceId = inserted[0].id;
          totalServicesSeeded++;
        } else {
          await prisma.$executeRawUnsafe(
            `INSERT INTO services (id, court_id, partner_id, category_id, name, type, price, cost_price, unit, status, track_inventory, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, CASE WHEN $3::text IS NULL OR $3::text = '' THEN NULL ELSE $3::uuid END, $4, $5, $6, $7, $8, 'ACTIVE', TRUE, NOW(), NOW());`,
            courtId, partnerId, catId, svc.name, svc.type, svc.price, svc.costPrice, svc.unit
          ).catch(() => {});

          const existing: any = await prisma.$queryRawUnsafe(
            `SELECT id FROM services WHERE court_id = $1 AND name = $2 LIMIT 1;`,
            courtId, svc.name
          ).catch(() => []);
          if (Array.isArray(existing) && existing.length > 0) {
            serviceId = existing[0].id;
            totalServicesSeeded++;
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
          totalLinksSeeded++;

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

    console.log(`[ServiceRepository] Redistributed services across ${courts.length} courts: ${totalServicesSeeded} services created, ${totalLinksSeeded} court-service links.`);
  } catch (err) {
    console.error("[ServiceRepository] forceSeedAllServicesToDb warning:", err);
  }
}

const seededCourtSet = new Set<string>();

async function ensureCourtServicesSeededInDb(courtId: string) {
  if (!courtId || seededCourtSet.has(courtId)) return;

  try {
    const courtInfoRows: any = await prisma.$queryRawUnsafe(
      `SELECT c.id, c.partner_id as "partnerId", c.name, cat.name as "categoryName", cat.slug as "categorySlug"
       FROM courts c
       LEFT JOIN categories cat ON c.category_id = cat.id
       WHERE c.id = $1 LIMIT 1;`,
      courtId
    ).catch(() => []);

    if (!Array.isArray(courtInfoRows) || courtInfoRows.length === 0) return;

    const partnerId = courtInfoRows[0].partnerId || "p0001";
    const courtName = String(courtInfoRows[0].name || "").toLowerCase();
    const fullText = `${courtName} ${String(courtInfoRows[0].categoryName || "")} ${String(courtInfoRows[0].categorySlug || "")}`.toLowerCase();

    const isBadminton = fullText.includes("cầu lông") || fullText.includes("badminton");
    const isTennis = fullText.includes("tennis");
    const isPickleball = fullText.includes("pickleball");
    const isFootball = fullText.includes("bóng đá") || fullText.includes("football") || fullText.includes("futsal") || fullText.includes("soccer");
    const isBasketball = fullText.includes("bóng rổ") || fullText.includes("basketball");
    const isVolleyball = fullText.includes("bóng chuyền") || fullText.includes("volleyball");

    // If court is NOT a racket sport, clean up any mistakenly seeded racket rental services
    if (!isBadminton && !isTennis && !isPickleball) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM services WHERE court_id = $1 AND (LOWER(name) LIKE '%vợt%' OR type = 'RENTAL_SERVICE');`,
        courtId
      ).catch(() => {});
    }

    const countRows: any = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as count FROM services WHERE court_id = $1;`,
      courtId
    ).catch(() => []);

    const count = Array.isArray(countRows) && countRows.length > 0 ? Number(countRows[0].count) : 0;
    if (count > 0) {
      seededCourtSet.add(courtId);
      return;
    }

    const masterServices = [
      // Drinks
      { name: "Nước suối Aquafina 500ml", categorySlug: "do-uong", type: "PRODUCT", price: 10000, costPrice: 4000, unit: "chai" },
      { name: "Coca Cola 330ml", categorySlug: "do-uong", type: "PRODUCT", price: 12000, costPrice: 7000, unit: "lon" },
      { name: "Pocari Sweat Bù Khoáng 500ml", categorySlug: "do-uong", type: "PRODUCT", price: 15000, costPrice: 9000, unit: "chai" },
      { name: "Redbull (Bò Húc Thái)", categorySlug: "do-uong", type: "PRODUCT", price: 18000, costPrice: 10000, unit: "lon" },
      { name: "Revive Chanh Muối 500ml", categorySlug: "do-uong", type: "PRODUCT", price: 15000, costPrice: 8000, unit: "chai" },

      // Fresh Fruit
      { name: "Hộp Dưa Hấu Ướp Lạnh", categorySlug: "trai-cay", type: "PRODUCT", price: 25000, costPrice: 12000, unit: "hộp" },
      { name: "Chuối Sứ Thể Thao", categorySlug: "trai-cay", type: "PRODUCT", price: 8000, costPrice: 4000, unit: "quả" },

      // Food & Snacks
      { name: "Bánh Mì Chả Pate", categorySlug: "do-an", type: "PRODUCT", price: 20000, costPrice: 11000, unit: "ổ" },
      { name: "Mì Ly Cung Đình Bò Hầm", categorySlug: "do-an", type: "PRODUCT", price: 15000, costPrice: 8000, unit: "ly" },
      { name: "Bánh Bao Nhân Thịt Trứng Cút", categorySlug: "do-an", type: "PRODUCT", price: 18000, costPrice: 10000, unit: "cái" },

      // Common Gear
      { name: "Khăn Lạnh Ướp Hương", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 5000, costPrice: 2000, unit: "cái" },
      { name: "Khăn Bông Thấm Mồ Hôi 100% Cotton", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 35000, costPrice: 18000, unit: "cái" },

      // 🎾 1. BADMINTON (Cầu lông - Có thuê vợt)
      ...(isBadminton ? [
        { name: "Thuê Vợt Cầu Lông Yonex Astrox", categorySlug: "cho-thue-dung-cu", type: "RENTAL_SERVICE", price: 40000, costPrice: 0, unit: "lượt" },
        { name: "Cho Thuê Vợt Cầu Lông Cao Cấp", categorySlug: "cho-thue-dung-cu", type: "RENTAL_SERVICE", price: 50000, costPrice: 10000, unit: "lượt" },
        { name: "Cầu Lông Ba Sao Đỏ (Ống 12 quả)", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 240000, costPrice: 170000, unit: "ống" },
        { name: "Quả Cầu Lông Thành Công (Hộp 12)", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 250000, costPrice: 180000, unit: "hộp" },
        { name: "Quấn Cán Vợt Cầu Lông Yonex", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 20000, costPrice: 8000, unit: "cái" },
        { name: "Vớ Thể Thao Yonex Chống Trượt", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 30000, costPrice: 15000, unit: "đôi" }
      ] : []),

      // 🎾 2. TENNIS (Tennis - Có thuê vợt)
      ...(isTennis ? [
        { name: "Thuê Vợt Tennis Wilson Pro", categorySlug: "cho-thue-dung-cu", type: "RENTAL_SERVICE", price: 80000, costPrice: 0, unit: "lượt" },
        { name: "Cho Thuê Vợt Tennis Babolat", categorySlug: "cho-thue-dung-cu", type: "RENTAL_SERVICE", price: 100000, costPrice: 20000, unit: "lượt" },
        { name: "Bóng Tennis Wilson (Hộp 3 quả)", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 95000, costPrice: 65000, unit: "hộp" },
        { name: "Bóng Tennis Wilson US Open", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 110000, costPrice: 75000, unit: "hộp" },
        { name: "Quấn Cán Vợt Tennis Babolat", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 25000, costPrice: 10000, unit: "cái" },
        { name: "Vớ Thể Thao Tennis Cotton", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 35000, costPrice: 18000, unit: "đôi" }
      ] : []),

      // 🎾 3. PICKLEBALL (Pickleball - Có thuê vợt)
      ...(isPickleball ? [
        { name: "Thuê Vợt Pickleball Selkirk", categorySlug: "cho-thue-dung-cu", type: "RENTAL_SERVICE", price: 60000, costPrice: 0, unit: "lượt" },
        { name: "Cho Thuê Vợt Pickleball Franklin", categorySlug: "cho-thue-dung-cu", type: "RENTAL_SERVICE", price: 50000, costPrice: 10000, unit: "lượt" },
        { name: "Bóng Pickleball Franklin X-40", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 45000, costPrice: 28000, unit: "quả" },
        { name: "Bóng Pickleball Diadem (Hộp 3 quả)", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 120000, costPrice: 80000, unit: "hộp" },
        { name: "Vớ Thể Thao Pickleball Chống Trượt", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 30000, costPrice: 15000, unit: "đôi" }
      ] : []),

      // ⚽ 4. FOOTBALL (Bóng đá - Không thuê vợt!)
      ...(isFootball ? [
        { name: "Cho Thuê Bóng Đá Động Lực Số 5", categorySlug: "cho-thue-dung-cu", type: "RENTAL_SERVICE", price: 30000, costPrice: 0, unit: "trận" },
        { name: "Băng Bọc Ống Quyển Chống Chấn Thương", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 45000, costPrice: 22000, unit: "cặp" },
        { name: "Vớ Đá Bóng Cổ Cao Dày 100% Cotton", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 35000, costPrice: 16000, unit: "đôi" },
        { name: "Vớ Chống Trượt Đá Bóng Fox-Socks", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 40000, costPrice: 20000, unit: "đôi" },
        { name: "Thuê Bộ 10 Áo Bít Phân Đội Đá Bóng", categorySlug: "cho-thue-dung-cu", type: "RENTAL_SERVICE", price: 50000, costPrice: 10000, unit: "bộ" }
      ] : []),

      // 🏀 5. BASKETBALL (Bóng rổ - Không thuê vợt!)
      ...(isBasketball ? [
        { name: "Cho Thuê Bóng Rổ Molten Da Thật", categorySlug: "cho-thue-dung-cu", type: "RENTAL_SERVICE", price: 30000, costPrice: 0, unit: "lượt" },
        { name: "Băng Bọc Cổ Tay & Ngón Tay Thể Thao", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 20000, costPrice: 9000, unit: "cái" },
        { name: "Vớ Bóng Rổ Cổ Cao Đệm Dày Chống Trượt", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 40000, costPrice: 18000, unit: "đôi" },
        { name: "Băng Đệm Bảo Vệ Đầu Gối / Khuỷu Tay", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 50000, costPrice: 25000, unit: "cặp" }
      ] : []),

      // 🏐 6. VOLLEYBALL (Bóng chuyền - Không thuê vợt!)
      ...(isVolleyball ? [
        { name: "Cho Thuê Bóng Chuyền Mikasa Da Thật", categorySlug: "cho-thue-dung-cu", type: "RENTAL_SERVICE", price: 30000, costPrice: 0, unit: "lượt" },
        { name: "Băng Đệm Bảo Vệ Đầu Gối Thi Đấu", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 60000, costPrice: 30000, unit: "cặp" },
        { name: "Băng Bảo Vệ Cổ Tay / Cánh Tay", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 35000, costPrice: 16000, unit: "cặp" },
        { name: "Vớ Thể Thao Chuyên Dụng Thi Đấu", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 30000, costPrice: 15000, unit: "đôi" }
      ] : []),

      // Combos
      { name: "Combo Đôi Năng Lượng (2 Suối + 1 Dưa Hấu + 2 Khăn)", categorySlug: "combo-the-thao", type: "PRODUCT", price: 45000, costPrice: 22000, unit: "combo" },
      { name: "Combo Team 4 Đập Phá (4 Nước Ngọt + 1 Đĩa Trái Cây + 4 Khăn)", categorySlug: "combo-the-thao", type: "PRODUCT", price: 110000, costPrice: 58000, unit: "combo" }
    ];

    const catRows: any = await prisma.$queryRawUnsafe(`SELECT id, slug FROM service_categories;`).catch(() => []);
    const catMap = new Map<string, string>();
    if (Array.isArray(catRows)) {
      for (const r of catRows) catMap.set(r.slug, r.id);
    }

    for (const svc of masterServices) {
      const categoryId = catMap.get(svc.categorySlug) || null;
      const res: any = await prisma.$queryRawUnsafe(
        `INSERT INTO services (id, partner_id, court_id, category_id, name, description, type, price, cost_price, unit, status, track_inventory, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3::uuid, $4, $5, $6, $7, $8, $9, 'ACTIVE', true, NOW(), NOW())
         RETURNING id;`,
        partnerId, courtId, categoryId, svc.name, `${svc.name} phục vụ tại ${courtInfoRows[0].name}`, svc.type, svc.price, svc.costPrice, svc.unit
      ).catch(() => []);

      if (Array.isArray(res) && res.length > 0 && res[0].id) {
        const serviceId = res[0].id;
        await prisma.$executeRawUnsafe(
          `INSERT INTO service_inventories (id, service_id, quantity, reserved_quantity, minimum_stock, unit, last_purchase_price, created_at, updated_at)
           VALUES (gen_random_uuid(), $1::uuid, 50, 0, 5, $2, $3, NOW(), NOW());`,
          serviceId, svc.unit, svc.costPrice
        ).catch(() => {});
      }
    }
    seededCourtSet.add(courtId);
  } catch (err) {
    console.error("[ServiceRepository] ensureCourtServicesSeededInDb error:", err);
  }
}

export const serviceRepository = {
  async listCategories() {
    try {
      await ensureServiceTables();
      const rows: any = await prisma.$queryRawUnsafe(
        `SELECT id, name, slug, description FROM service_categories ORDER BY name ASC;`
      ).catch(() => []);

      if (Array.isArray(rows) && rows.length > 0) return rows;

      const defaultCategories = [
        { name: "Đồ uống", slug: "do-uong", description: "Các loại nước giải khát, nước suối, nước tăng lực, bù khoáng" },
        { name: "Đồ ăn", slug: "do-an", description: "Bánh mì, bánh ngọt, đồ ăn nhẹ, mì cốc" },
        { name: "Trái cây", slug: "trai-cay", description: "Trái cây tươi đóng hộp ướp lạnh" },
        { name: "Phụ kiện thể thao", slug: "dung-cu-the-thao", description: "Bóng, cầu lông, vớ, khăn tập, băng trán" },
        { name: "Cho thuê dụng cụ", slug: "cho-thue-dung-cu", description: "Cho thuê vợt Tennis, Cầu lông, Pickleball" },
        { name: "Combo thể thao", slug: "combo-the-thao", description: "Các gói Combo tiết kiệm cho cá nhân và nhóm/đội" },
        { name: "Dịch vụ khác", slug: "dich-vu-khac", description: "Các dịch vụ tiện ích bổ sung tại sân" }
      ];

      for (const cat of defaultCategories) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO service_categories (id, name, slug, description) VALUES (gen_random_uuid(), $1, $2, $3) ON CONFLICT (slug) DO NOTHING;`,
          cat.name, cat.slug, cat.description
        ).catch(() => {});
      }

      const fresh: any = await prisma.$queryRawUnsafe(
        `SELECT id, name, slug, description FROM service_categories ORDER BY name ASC;`
      ).catch(() => []);

      return Array.isArray(fresh) ? fresh : [];
    } catch (err) {
      console.error("[ServiceRepository] listCategories error:", err);
      return [];
    }
  },

  async createCategory(data: CreateServiceCategoryInput) {
    await ensureServiceTables();
    const slug = data.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
    return prisma.serviceCategory.create({
      data: {
        name: data.name,
        slug,
        description: data.description
      }
    });
  },

  async findServiceById(id: string) {
    await ensureServiceTables();
    return prisma.service.findUnique({
      where: { id },
      include: {
        category: true,
        inventory: true
      }
    });
  },

  async listPartnerServices(partnerId: string, categoryId?: string, search?: string) {
    await ensureServiceTables();
    try {
      const validCategoryId = categoryId && categoryId.trim() !== "" ? categoryId.trim() : undefined;
      const validSearch = search && search.trim() !== "" ? search.trim() : undefined;

      const where: any = {
        ...(partnerId ? { partnerId } : {}),
        ...(validCategoryId ? { categoryId: validCategoryId } : {}),
        ...(validSearch
          ? {
              OR: [
                { name: { contains: validSearch, mode: "insensitive" } },
                { description: { contains: validSearch, mode: "insensitive" } }
              ]
            }
          : {})
      };

      let services = await prisma.service.findMany({
        where,
        include: {
          category: true,
          inventory: true
        },
        orderBy: { createdAt: "desc" }
      });

      if (!Array.isArray(services) || services.length === 0) {
        const rawSvcs: any = await prisma.$queryRawUnsafe(`
          SELECT 
            s.id,
            s.partner_id as "partnerId",
            s.category_id as "categoryId",
            s.name,
            s.description,
            s.type,
            s.sport_type as "sportType",
            s.price,
            s.cost_price as "costPrice",
            s.unit,
            s.image_url as "imageUrl",
            s.status,
            s.track_inventory as "trackInventory",
            c.name as "categoryName",
            COALESCE(si.quantity, 50) as quantity,
            COALESCE(si.minimum_stock, 5) as "minimumStock"
          FROM services s
          LEFT JOIN service_categories c ON s.category_id = c.id
          LEFT JOIN service_inventories si ON s.id = si.service_id
          WHERE ($1::text IS NULL OR $1::text = '' OR s.partner_id = $1)
          ORDER BY s.created_at DESC;
        `, partnerId || "").catch(() => []);

        if (Array.isArray(rawSvcs) && rawSvcs.length > 0) {
          services = rawSvcs.map((r: any) => ({
            id: r.id,
            partnerId: r.partnerId,
            categoryId: r.categoryId,
            name: r.name,
            description: r.description,
            type: r.type,
            sportType: r.sportType,
            price: Number(r.price),
            costPrice: Number(r.costPrice || 0),
            unit: r.unit,
            imageUrl: r.imageUrl,
            status: r.status,
            trackInventory: r.trackInventory,
            category: r.categoryName ? { id: r.categoryId, name: r.categoryName } : null,
            inventory: {
              quantity: Number(r.quantity),
              minimumStock: Number(r.minimumStock)
            }
          })) as any;
        }
      }

      // Deduplicate by name
      const seenNames = new Set<string>();
      const uniqueServices: any[] = [];
      for (const s of services || []) {
        if (s && s.name && !seenNames.has(s.name)) {
          seenNames.add(s.name);
          uniqueServices.push(s);
        }
      }

      return uniqueServices;
    } catch (err) {
      console.error("[ServiceRepository] listPartnerServices error:", err);
      return [];
    }
  },

  async listServicesForCourt(courtId: string, categoryId?: string) {
    try {
      await ensureServiceTables();
      await ensureCourtServicesSeededInDb(courtId);

      const rows: any = await prisma.$queryRawUnsafe(`
        SELECT
          s.id,
          s.court_id as "courtId",
          s.partner_id as "partnerId",
          s.category_id as "categoryId",
          s.name,
          s.description,
          s.type,
          s.price,
          s.cost_price as "costPrice",
          s.unit,
          s.status,
          s.track_inventory as "trackInventory",
          sc.name as "categoryName",
          sc.slug as "categorySlug",
          si.id as "inventoryId",
          COALESCE(si.quantity, 50) as "inventoryQuantity",
          si.reserved_quantity as "inventoryReservedQuantity",
          COALESCE(si.minimum_stock, 5) as "inventoryMinimumStock",
          si.unit as "inventoryUnit",
          si.last_purchase_price as "inventoryLastPurchasePrice"
        FROM services s
        LEFT JOIN service_categories sc ON s.category_id = sc.id
        LEFT JOIN service_inventories si ON si.service_id = s.id
        WHERE s.court_id = $1 AND (s.status = 'ACTIVE' OR s.status IS NULL)
        ORDER BY sc.name ASC, s.name ASC;
      `, courtId).catch(() => []);

      if (!Array.isArray(rows) || rows.length === 0) return [];

      let filtered = rows;
      if (categoryId) {
        filtered = rows.filter((r: any) => r.categoryId === categoryId);
      }

      const seenNames = new Set<string>();
      const uniqueRows: any[] = [];
      for (const r of filtered) {
        const key = r && r.name ? String(r.name).trim().toLowerCase() : "";
        if (key && !seenNames.has(key)) {
          seenNames.add(key);
          uniqueRows.push({
            id: r.id,
            courtId: r.courtId || courtId,
            partnerId: r.partnerId,
            categoryId: r.categoryId,
            name: r.name,
            description: r.description,
            type: r.type,
            price: Number(r.price),
            originalPrice: Number(r.price),
            costPrice: Number(r.costPrice || 0),
            unit: r.unit,
            status: r.status,
            trackInventory: r.trackInventory,
            categoryName: r.categoryName,
            categorySlug: r.categorySlug,
            category: r.categoryId ? { id: r.categoryId, name: r.categoryName, slug: r.categorySlug } : null,
            inventory: {
              id: r.inventoryId,
              serviceId: r.id,
              quantity: Number(r.inventoryQuantity ?? 50),
              reservedQuantity: Number(r.inventoryReservedQuantity ?? 0),
              minimumStock: Number(r.inventoryMinimumStock ?? 5),
              unit: r.unit,
              lastPurchasePrice: Number(r.inventoryLastPurchasePrice ?? 0)
            }
          });
        }
      }

      return uniqueRows;
    } catch (err) {
      console.error("[ServiceRepository] listServicesForCourt error:", err);
      return [];
    }
  },

  async createService(partnerId: string, data: CreateServiceInput) {
    await ensureServiceTables();
    return prisma.$transaction(async (tx) => {
      const cleanCategoryId = data.categoryId && data.categoryId.trim() !== "" && data.categoryId !== "ALL" ? data.categoryId.trim() : null;
      const cleanImageUrl = data.imageUrl && data.imageUrl.trim() !== "" ? data.imageUrl.trim() : null;

      const service = await tx.service.create({
        data: {
          partnerId,
          categoryId: cleanCategoryId,
          name: data.name,
          description: data.description ?? null,
          type: data.type,
          sportType: data.sportType ?? "ALL",
          price: data.price,
          costPrice: data.costPrice ?? 0,
          unit: data.unit ?? "cái",
          imageUrl: cleanImageUrl,
          trackInventory: data.trackInventory ?? true
        }
      });

      const initialQty = data.initialStock ?? 50;
      if (data.trackInventory) {
        await tx.serviceInventory.create({
          data: {
            serviceId: service.id,
            quantity: initialQty,
            minimumStock: data.minimumStock ?? 5,
            unit: data.unit ?? "cái",
            lastPurchasePrice: data.costPrice ?? 0
          }
        });

        if (initialQty > 0) {
          await tx.inventoryTransaction.create({
            data: {
              serviceId: service.id,
              type: "IMPORT",
              quantity: initialQty,
              unitCost: data.costPrice ?? 0,
              referenceType: "INITIAL_STOCK",
              note: "Tồn kho khởi tạo ban đầu"
            }
          });
        }
      }

      // Map new service to court_services for all courts
      const courts: any = await tx.$queryRawUnsafe(
        `SELECT id FROM courts WHERE partner_id = $1 OR partner_id = 'p0001';`,
        partnerId
      ).catch(() => []);

      if (Array.isArray(courts) && courts.length > 0) {
        for (const court of courts) {
          const customId = `cs_${court.id}_${service.id.slice(0, 8)}`;
          await tx.$executeRawUnsafe(
            `INSERT INTO court_services (id, court_id, service_id, name, price, is_available, status, created_at, updated_at)
             VALUES ($1, $2, $3::uuid, $4, $5, TRUE, 'ACTIVE', NOW(), NOW())
             ON CONFLICT (id) DO UPDATE SET price = EXCLUDED.price, status = 'ACTIVE';`,
            customId, court.id, service.id, service.name, service.price
          ).catch(() => {});
        }
      }

      return tx.service.findUnique({
        where: { id: service.id },
        include: { category: true, inventory: true }
      });
    });
  },

  async updateService(id: string, data: UpdateServiceInput) {
    await ensureServiceTables();
    return prisma.$transaction(async (tx) => {
      const updated = await tx.service.update({
        where: { id },
        data: {
          ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.type !== undefined ? { type: data.type } : {}),
          ...(data.sportType !== undefined ? { sportType: data.sportType } : {}),
          ...(data.price !== undefined ? { price: data.price } : {}),
          ...(data.costPrice !== undefined ? { costPrice: data.costPrice } : {}),
          ...(data.unit !== undefined ? { unit: data.unit } : {}),
          ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.trackInventory !== undefined ? { trackInventory: data.trackInventory } : {})
        }
      });

      if (data.minimumStock !== undefined) {
        await tx.serviceInventory.upsert({
          where: { serviceId: id },
          update: { minimumStock: data.minimumStock },
          create: {
            serviceId: id,
            minimumStock: data.minimumStock,
            quantity: 0,
            unit: data.unit ?? "cái"
          }
        });
      }

      return tx.service.findUnique({
        where: { id },
        include: { category: true, inventory: true }
      });
    });
  },

  async deleteService(id: string) {
    await ensureServiceTables();
    return prisma.service.delete({ where: { id } });
  },

  async seedDefaultPartnerServices(partnerId: string) {
    await ensureServiceTables();
    const existing = await prisma.service.count({ where: { partnerId } });
    if (existing > 0) return;

    const categories = await prisma.serviceCategory.findMany();
    const catMap = new Map(categories.map((c) => [c.slug, c.id]));

    const samples: CreateServiceInput[] = [
      { name: "Nước suối Aquafina 500ml", categoryId: catMap.get("do-uong"), type: "PRODUCT", price: 10000, costPrice: 4000, unit: "chai", initialStock: 200, minimumStock: 30 },
      { name: "Coca Cola 330ml", categoryId: catMap.get("do-uong"), type: "PRODUCT", price: 12000, costPrice: 7000, unit: "lon", initialStock: 120, minimumStock: 20 },
      { name: "Pepsi Vị Chanh", categoryId: catMap.get("do-uong"), type: "PRODUCT", price: 12000, costPrice: 7000, unit: "lon", initialStock: 120, minimumStock: 20 },
      { name: "7Up Chanh", categoryId: catMap.get("do-uong"), type: "PRODUCT", price: 12000, costPrice: 7000, unit: "lon", initialStock: 100, minimumStock: 20 },
      { name: "Sting Dâu Đỏ", categoryId: catMap.get("do-uong"), type: "PRODUCT", price: 12000, costPrice: 7000, unit: "chai", initialStock: 100, minimumStock: 20 },
      { name: "Pocari Sweat Bù Khoáng", categoryId: catMap.get("do-uong"), type: "PRODUCT", price: 15000, costPrice: 9000, unit: "chai", initialStock: 100, minimumStock: 20 },
      { name: "Redbull (Bò Húc Thái)", categoryId: catMap.get("do-uong"), type: "PRODUCT", price: 18000, costPrice: 10000, unit: "lon", initialStock: 90, minimumStock: 15 },
      { name: "Trà Đào Cam Sả Tươi", categoryId: catMap.get("do-uong"), type: "PRODUCT", price: 25000, costPrice: 12000, unit: "ly", initialStock: 50, minimumStock: 10 },
      { name: "Nước Dừa Tươi Ướp Lạnh", categoryId: catMap.get("do-uong"), type: "PRODUCT", price: 25000, costPrice: 15000, unit: "trái", initialStock: 40, minimumStock: 10 },
      { name: "Hộp Dưa Hấu Ướp Lạnh", categoryId: catMap.get("trai-cay"), type: "PRODUCT", price: 25000, costPrice: 12000, unit: "hộp", initialStock: 30, minimumStock: 5 },
      { name: "Hộp Xoài Lắc Muối Ớt", categoryId: catMap.get("trai-cay"), type: "PRODUCT", price: 25000, costPrice: 12000, unit: "hộp", initialStock: 30, minimumStock: 5 },
      { name: "Hộp Ổi Giòn Ngọt", categoryId: catMap.get("trai-cay"), type: "PRODUCT", price: 20000, costPrice: 10000, unit: "hộp", initialStock: 30, minimumStock: 5 },
      { name: "Hộp Nho Mỹ Không Hạt", categoryId: catMap.get("trai-cay"), type: "PRODUCT", price: 40000, costPrice: 22000, unit: "hộp", initialStock: 20, minimumStock: 5 },
      { name: "Đĩa Trái Cây Thập Cẩm Lớn", categoryId: catMap.get("trai-cay"), type: "PRODUCT", price: 65000, costPrice: 35000, unit: "đĩa", initialStock: 15, minimumStock: 3 },
      { name: "Chuối Sứ Thể Thao", categoryId: catMap.get("trai-cay"), type: "PRODUCT", price: 8000, costPrice: 4000, unit: "quả", initialStock: 60, minimumStock: 10 },
      { name: "Bánh Mì Chả Pate", categoryId: catMap.get("do-an"), type: "PRODUCT", price: 20000, costPrice: 11000, unit: "ổ", initialStock: 30, minimumStock: 5 },
      { name: "Bánh Mì Ốp La 2 Trứng", categoryId: catMap.get("do-an"), type: "PRODUCT", price: 25000, costPrice: 13000, unit: "ổ", initialStock: 30, minimumStock: 5 },
      { name: "Mì Ly Cung Đình Bò Hầm", categoryId: catMap.get("do-an"), type: "PRODUCT", price: 15000, costPrice: 8000, unit: "ly", initialStock: 40, minimumStock: 10 },
      { name: "Xúc Xích Nướng Đức", categoryId: catMap.get("do-an"), type: "PRODUCT", price: 15000, costPrice: 7000, unit: "cây", initialStock: 50, minimumStock: 10 },
      { name: "Bánh Bao Nhân Thịt Trứng Cút", categoryId: catMap.get("do-an"), type: "PRODUCT", price: 18000, costPrice: 10000, unit: "cái", initialStock: 25, minimumStock: 5 },
      { name: "Vớ Thể Thao Yonex", categoryId: catMap.get("dung-cu-the-thao"), type: "PRODUCT", price: 25000, costPrice: 12000, unit: "đôi", initialStock: 60, minimumStock: 10 },
      { name: "Khăn Lạnh Ướp Hương", categoryId: catMap.get("dung-cu-the-thao"), type: "PRODUCT", price: 5000, costPrice: 2000, unit: "cái", initialStock: 200, minimumStock: 30 },
      { name: "Khăn Bông Thấm Mồ Hôi 100% Cotton", categoryId: catMap.get("dung-cu-the-thao"), type: "PRODUCT", price: 35000, costPrice: 18000, unit: "cái", initialStock: 40, minimumStock: 10 },
      { name: "Băng Trán / Cổ Tay Thể Thao", categoryId: catMap.get("dung-cu-the-thao"), type: "PRODUCT", price: 20000, costPrice: 9000, unit: "cái", initialStock: 50, minimumStock: 10 },
      { name: "Bóng Tennis Wilson (Hộp 3 quả)", categoryId: catMap.get("dung-cu-the-thao"), type: "PRODUCT", sportType: "TENNIS", price: 95000, costPrice: 65000, unit: "hộp", initialStock: 25, minimumStock: 5 },
      { name: "Cầu Lông Ba Sao Đỏ (Ống 12 quả)", categoryId: catMap.get("dung-cu-the-thao"), type: "PRODUCT", sportType: "BADMINTON", price: 240000, costPrice: 170000, unit: "ống", initialStock: 15, minimumStock: 3 },
      { name: "Bóng Pickleball Franklin X-40 (Quả)", categoryId: catMap.get("dung-cu-the-thao"), type: "PRODUCT", sportType: "PICKLEBALL", price: 45000, costPrice: 28000, unit: "quả", initialStock: 50, minimumStock: 10 },
      // Cho thuê
      { name: "Thuê Vợt Tennis Wilson Pro", categoryId: catMap.get("cho-thue-dung-cu"), type: "RENTAL_SERVICE", sportType: "TENNIS", price: 80000, costPrice: 0, unit: "lượt", initialStock: 10, minimumStock: 2 },
      { name: "Thuê Vợt Cầu Lông Yonex Astrox", categoryId: catMap.get("cho-thue-dung-cu"), type: "RENTAL_SERVICE", sportType: "BADMINTON", price: 40000, costPrice: 0, unit: "lượt", initialStock: 20, minimumStock: 3 },
      { name: "Thuê Vợt Pickleball Selkirk / JOOLA", categoryId: catMap.get("cho-thue-dung-cu"), type: "RENTAL_SERVICE", sportType: "PICKLEBALL", price: 60000, costPrice: 0, unit: "lượt", initialStock: 15, minimumStock: 2 },

      // Combo Thể Thao (Ưu Đãi)
      { name: "Combo Đôi Năng Lượng (2 Suối + 1 Hộp Dưa Hấu + 2 Khăn Lạnh)", categoryId: catMap.get("combo-the-thao"), type: "PRODUCT", price: 45000, costPrice: 22000, unit: "combo", initialStock: 50, minimumStock: 10 },
      { name: "Combo Team 4 Đập Phá (4 Nước Ngọt + 1 Đĩa Trái Cây Lớn + 4 Khăn Lạnh)", categoryId: catMap.get("combo-the-thao"), type: "PRODUCT", price: 110000, costPrice: 58000, unit: "combo", initialStock: 30, minimumStock: 5 },
      { name: "Combo Thể Lực Tốc Độ (1 Pocari + 1 Redbull + 2 Chuối Sứ)", categoryId: catMap.get("combo-the-thao"), type: "PRODUCT", price: 42000, costPrice: 22000, unit: "combo", initialStock: 40, minimumStock: 10 },
      { name: "Combo Trọn Gói Pickleball (Thuê 2 Vợt + 2 Bóng + 2 Nước Suối)", categoryId: catMap.get("combo-the-thao"), type: "PRODUCT", sportType: "PICKLEBALL", price: 195000, costPrice: 56000, unit: "combo", initialStock: 25, minimumStock: 5 }
    ];

    for (const sample of samples) {
      await this.createService(partnerId, sample);
    }
    console.log(`[ServiceRepository] Seeded default services for partner ${partnerId}`);
  }
};
