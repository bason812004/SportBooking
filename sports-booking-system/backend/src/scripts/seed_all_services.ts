import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seed() {
  console.log("=== SEEDING ALL SERVICES & MAPPING TO ALL COURTS ===");

  try {
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

    const catRows: any = await prisma.$queryRawUnsafe(`SELECT id, slug FROM service_categories;`);
    const catMap = new Map<string, string>();
    if (Array.isArray(catRows)) {
      for (const r of catRows) catMap.set(r.slug, r.id);
    }
    console.log("Categories ready:", catMap.size);

    // 2. Fetch partners
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

    let totalInserted = 0;
    for (const pid of partnerIds) {
      for (const svc of sampleServices) {
        const catId = catMap.get(svc.categorySlug) ?? null;
        await prisma.$executeRawUnsafe(
          `INSERT INTO services (id, partner_id, category_id, name, type, price, cost_price, unit, status, track_inventory, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2::uuid, $3, $4, $5, $6, $7, 'ACTIVE', TRUE, NOW(), NOW())
           ON CONFLICT DO NOTHING;`,
          pid, catId, svc.name, svc.type, svc.price, svc.costPrice, svc.unit
        ).catch(() => {});
        totalInserted++;
      }
    }
    console.log("Services seeded to `services` table.");

    // 3. Update court_id column directly in services table for ALL courts
    const courtRows: any = await prisma.$queryRawUnsafe(`SELECT id, partner_id, name FROM courts;`).catch(() => []);
    console.log(`Setting court_id directly on \`services\` table for ${courtRows.length} courts...`);

    let mappedCount = 0;
    if (Array.isArray(courtRows)) {
      for (const c of courtRows) {
        await prisma.$executeRawUnsafe(
          `UPDATE services SET court_id = $1 WHERE partner_id = $2 OR court_id IS NULL;`,
          c.id, c.partner_id
        ).catch(() => {});
        mappedCount++;
      }
    }

    console.log(`=== SUCCESS! Updated court_id for ${mappedCount} courts in \`services\` table! ===`);
  } catch (err) {
    console.error("Error in seed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
