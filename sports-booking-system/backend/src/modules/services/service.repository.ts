import crypto from "crypto";
import { prisma } from "../../config/db.js";
import type { CreateServiceCategoryInput, CreateServiceInput, UpdateServiceInput } from "./service.types.js";

let tablesReady = false;
let isInitializing = false;

export async function ensureServiceTables() {
  if (tablesReady || isInitializing) return;
  isInitializing = true;

  setTimeout(async () => {
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
        );`
      ];

      for (const statement of statements) {
        await prisma.$executeRawUnsafe(statement).catch(() => {});
      }

      console.log("[ServiceRepository] Schema & categories checked/initialized.");
      await forceSeedAllServicesToDb().catch(() => {});
    } catch (err) {
      console.error("[ServiceRepository] Table setup warning:", err);
    } finally {
      tablesReady = true;
    }
  }, 100);
}

export async function forceSeedAllServicesToDb() {
  try {
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

    const catRows: any = await prisma.$queryRawUnsafe(`SELECT id, slug FROM service_categories;`).catch(() => []);
    const catMap = new Map<string, string>();
    if (Array.isArray(catRows)) {
      for (const r of catRows) {
        catMap.set(r.slug, r.id);
      }
    }

    const partnerRows: any = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT partner_id as pid FROM courts WHERE partner_id IS NOT NULL AND partner_id != ''
      UNION
      SELECT id as pid FROM users WHERE role = 'PARTNER'
      UNION SELECT 'partner_01' as pid UNION SELECT 'p0001' as pid;
    `).catch(() => [{ pid: "p0001" }]);

    const partnerIds: string[] = Array.isArray(partnerRows)
      ? partnerRows.map((r: any) => r.pid).filter(Boolean)
      : ["p0001"];

    const sampleServices = [
      { name: "Nước suối Aquafina 500ml", categorySlug: "do-uong", type: "PRODUCT", price: 10000, costPrice: 4000, unit: "chai" },
      { name: "Coca Cola 330ml", categorySlug: "do-uong", type: "PRODUCT", price: 12000, costPrice: 7000, unit: "lon" },
      { name: "Pepsi Vị Chanh 330ml", categorySlug: "do-uong", type: "PRODUCT", price: 12000, costPrice: 7000, unit: "lon" },
      { name: "7Up Vị Chanh 330ml", categorySlug: "do-uong", type: "PRODUCT", price: 12000, costPrice: 7000, unit: "lon" },
      { name: "Sting Dâu Đỏ 330ml", categorySlug: "do-uong", type: "PRODUCT", price: 12000, costPrice: 7000, unit: "chai" },
      { name: "Pocari Sweat Bù Khoáng 500ml", categorySlug: "do-uong", type: "PRODUCT", price: 15000, costPrice: 9000, unit: "chai" },
      { name: "Redbull (Bò Húc Thái)", categorySlug: "do-uong", type: "PRODUCT", price: 18000, costPrice: 10000, unit: "lon" },
      { name: "Trà Đào Cam Sả Tươi", categorySlug: "do-uong", type: "PRODUCT", price: 25000, costPrice: 12000, unit: "ly" },
      { name: "Nước Dừa Tươi Ướp Lạnh", categorySlug: "do-uong", type: "PRODUCT", price: 25000, costPrice: 15000, unit: "trái" },

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

      { name: "Vớ Thể Thao Yonex", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 25000, costPrice: 12000, unit: "đôi" },
      { name: "Khăn Lạnh Ướp Hương", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 5000, costPrice: 2000, unit: "cái" },
      { name: "Khăn Bông Thấm Mồ Hôi 100% Cotton", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 35000, costPrice: 18000, unit: "cái" },
      { name: "Băng Trán / Cổ Tay Thể Thao", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 20000, costPrice: 9000, unit: "cái" },
      { name: "Bóng Tennis Wilson (Hộp 3 quả)", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 95000, costPrice: 65000, unit: "hộp" },
      { name: "Cầu Lông Ba Sao Đỏ (Ống 12 quả)", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 240000, costPrice: 170000, unit: "ống" },
      { name: "Bóng Pickleball Franklin X-40", categorySlug: "dung-cu-the-thao", type: "PRODUCT", price: 45000, costPrice: 28000, unit: "quả" },

      { name: "Thuê Vợt Tennis Wilson Pro", categorySlug: "cho-thue-dung-cu", type: "RENTAL_SERVICE", price: 80000, costPrice: 0, unit: "lượt" },
      { name: "Thuê Vợt Cầu Lông Yonex Astrox", categorySlug: "cho-thue-dung-cu", type: "RENTAL_SERVICE", price: 40000, costPrice: 0, unit: "lượt" },
      { name: "Thuê Vợt Pickleball Selkirk", categorySlug: "cho-thue-dung-cu", type: "RENTAL_SERVICE", price: 60000, costPrice: 0, unit: "lượt" },

      { name: "Combo Đôi Năng Lượng (2 Suối + 1 Dưa Hấu + 2 Khăn)", categorySlug: "combo-the-thao", type: "PRODUCT", price: 45000, costPrice: 22000, unit: "combo" },
      { name: "Combo Team 4 Đập Phá (4 Nước Ngọt + 1 Đĩa Trái Cây + 4 Khăn)", categorySlug: "combo-the-thao", type: "PRODUCT", price: 110000, costPrice: 58000, unit: "combo" },
      { name: "Combo Thể Lực Tốc Độ (1 Pocari + 1 Redbull + 2 Chuối Sứ)", categorySlug: "combo-the-thao", type: "PRODUCT", price: 42000, costPrice: 22000, unit: "combo" }
    ];

    // Bulk check existing services to prevent N queries
    const existingRows: any = await prisma.$queryRawUnsafe(`SELECT partner_id, name FROM services;`).catch(() => []);
    const existingSet = new Set<string>();
    if (Array.isArray(existingRows)) {
      for (const r of existingRows) {
        existingSet.add(`${r.partner_id}:${r.name}`);
      }
    }

    let totalInserted = 0;
    for (const pid of partnerIds) {
      for (const svc of sampleServices) {
        const key = `${pid}:${svc.name}`;
        if (!existingSet.has(key)) {
          const catId = catMap.get(svc.categorySlug) ?? null;
          await prisma.$executeRawUnsafe(
            `INSERT INTO services (id, partner_id, category_id, name, type, price, cost_price, unit, status, track_inventory, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2::uuid, $3, $4, $5, $6, $7, 'ACTIVE', TRUE, NOW(), NOW());`,
            pid, catId, svc.name, svc.type, svc.price, svc.costPrice, svc.unit
          ).catch(() => {});
          existingSet.add(key);
          totalInserted++;
        }
      }
    }
    console.log(`[ServiceRepository] Seeded ${totalInserted} new services into services table.`);

    // Bulk check existing court_services
    const existingCsRows: any = await prisma.$queryRawUnsafe(`SELECT court_id, service_id FROM court_services;`).catch(() => []);
    const existingCsSet = new Set<string>();
    if (Array.isArray(existingCsRows)) {
      for (const r of existingCsRows) {
        existingCsSet.add(`${r.court_id}:${r.service_id}`);
      }
    }

    const courts: any = await prisma.$queryRawUnsafe(`SELECT id, partner_id, name FROM courts;`).catch(() => []);
    const allServices: any = await prisma.$queryRawUnsafe(`SELECT id, partner_id, name, price FROM services;`).catch(() => []);

    let mappedCount = 0;
    if (Array.isArray(courts) && Array.isArray(allServices)) {
      for (const court of courts) {
        // Seed 3 real sub-courts (Sân 01, Sân 02, Sân 03) into court_surfaces table
        for (let i = 1; i <= 3; i++) {
          const code = `S0${i}`;
          const surfaceName = `${court.name} - Sân 0${i}`;
          const customId = `csf_${court.id}_0${i}`;
          await prisma.$executeRawUnsafe(
            `INSERT INTO court_surfaces (id, court_id, code, name, capacity, surface, size, status, sort_order, created_at)
             VALUES ($1, $2, $3, $4, '7 người / Tiêu chuẩn', 'Mặt sân tiêu chuẩn', 'Tiêu chuẩn', 'ACTIVE', $5, NOW())
             ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = 'ACTIVE';`,
            customId, court.id, code, surfaceName, i
          ).catch(() => {});
        }

        const courtSvcs = allServices.filter((s: any) => s.partner_id === court.partner_id || !s.partner_id);
        const svcsToLink = courtSvcs.length > 0 ? courtSvcs : allServices.slice(0, 35);

        for (const s of svcsToLink) {
          const csKey = `${court.id}:${s.id}`;
          if (!existingCsSet.has(csKey)) {
            await prisma.$executeRawUnsafe(
              `INSERT INTO court_services (id, court_id, service_id, name, price, is_available, status, created_at, updated_at)
               VALUES ('cs_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16), $1, $2::uuid, $3, $4, TRUE, 'ACTIVE', NOW(), NOW());`,
              court.id, s.id, s.name, s.price
            ).catch(() => {});
            existingCsSet.add(csKey);
            mappedCount++;
          }
        }
      }
    }
    console.log(`[ServiceRepository] Mapped ${mappedCount} service-court links into court_services table!`);
  } catch (err) {
    console.error("[ServiceRepository] forceSeedAllServicesToDb warning:", err);
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
        { name: "Dụng cụ thể thao", slug: "dung-cu-the-thao", description: "Bóng, cầu lông, vớ, khăn tập, băng trán" },
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

      autoSeedSalaServicesAndAssignBooking().catch(() => {});

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
      return await prisma.service.findMany({
        where: {
          partnerId,
          ...(categoryId ? { categoryId } : {}),
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { description: { contains: search, mode: "insensitive" } }
                ]
              }
            : {})
        },
        include: {
          category: true,
          inventory: true
        },
        orderBy: { createdAt: "desc" }
      });
    } catch (err) {
      console.error("[ServiceRepository] listPartnerServices error:", err);
      return [];
    }
  },

  async listServicesForCourt(courtId: string, categoryId?: string) {
    try {
      await ensureServiceTables();

      let rows: any = await prisma.$queryRawUnsafe(`
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
          sc.name as "categoryName",
          sc.slug as "categorySlug"
        FROM services s
        LEFT JOIN service_categories sc ON s.category_id = sc.id
        WHERE (s.court_id = $1 OR s.court_id IS NULL) AND s.status = 'ACTIVE';
      `, courtId).catch(() => []);

      if (Array.isArray(rows) && rows.length > 0) {
        if (categoryId) {
          rows = rows.filter((r: any) => r.categoryId === categoryId);
        }
        return rows.map((r: any) => ({
          ...r,
          price: Number(r.price),
          originalPrice: Number(r.price)
        }));
      }

      // Fallback if empty
      const allSvc: any = await prisma.service.findMany({
        where: { ...(categoryId ? { categoryId } : {}) },
        include: { category: true }
      }).catch(() => []);

      return (allSvc || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        type: s.type || "PRODUCT",
        unit: s.unit || "cái",
        price: Number(s.price),
        categoryId: s.categoryId,
        category: s.category,
        isAvailable: true
      }));
    } catch (err) {
      console.error("[ServiceRepository] listServicesForCourt error:", err);
      return [];
    }
  },

  async createService(partnerId: string, data: CreateServiceInput) {
    await ensureServiceTables();
    return prisma.$transaction(async (tx) => {
      const service = await tx.service.create({
        data: {
          partnerId,
          categoryId: data.categoryId ?? null,
          name: data.name,
          description: data.description ?? null,
          type: data.type,
          sportType: data.sportType ?? "ALL",
          price: data.price,
          costPrice: data.costPrice ?? 0,
          unit: data.unit ?? "cái",
          imageUrl: data.imageUrl ?? null,
          trackInventory: data.trackInventory ?? true
        }
      });

      if (data.trackInventory) {
        await tx.serviceInventory.create({
          data: {
            serviceId: service.id,
            quantity: data.initialStock ?? 0,
            minimumStock: data.minimumStock ?? 5,
            unit: data.unit ?? "cái",
            lastPurchasePrice: data.costPrice ?? 0
          }
        });

        if ((data.initialStock ?? 0) > 0) {
          await tx.inventoryTransaction.create({
            data: {
              serviceId: service.id,
              type: "IMPORT",
              quantity: data.initialStock ?? 0,
              unitCost: data.costPrice ?? 0,
              referenceType: "INITIAL_STOCK",
              note: "Tồn kho khởi tạo ban đầu"
            }
          });
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
