import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== STARTING FIX & SEED FOR SALA 1 ===");

  // 1. Ensure Service Categories exist
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
    );
  }

  const dbCats = await prisma.serviceCategory.findMany();
  const catMap = new Map(dbCats.map((c) => [c.slug, c.id]));
  console.log("Categories ready:", dbCats.length);

  // 2. Find Sân Sala 1 or any court
  let court = await prisma.court.findFirst({
    where: { name: { contains: "Sala", mode: "insensitive" } },
    include: { surfaces: true, partner: true }
  });

  if (!court) {
    console.log("Court Sala not found, checking any court...");
    court = await prisma.court.findFirst({
      include: { surfaces: true, partner: true }
    });
  }

  if (!court) {
    console.error("No courts found in database!");
    return;
  }

  console.log(`Found Court: ${court.name} (ID: ${court.id}, PartnerId: ${court.partnerId})`);

  // Ensure surfaces exist
  if (court.surfaces.length === 0) {
    console.log("Seeding surfaces for court...");
    for (let i = 1; i <= 3; i++) {
      const code = `S0${i}`;
      const name = `${court.name} - Sân 0${i}`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO court_surfaces (court_id, code, name, capacity, surface, size, status, sort_order, created_at)
         VALUES ($1, $2, $3, '7 người', 'Cỏ nhân tạo', 'Tiêu chuẩn', 'ACTIVE', $4, NOW())
         ON CONFLICT DO NOTHING;`,
        court.id, code, name, i
      );
    }
  }

  const updatedCourt = await prisma.court.findUnique({
    where: { id: court.id },
    include: { surfaces: true }
  });
  const surface01 = updatedCourt?.surfaces[0];
  console.log("Surface 01:", surface01?.name, surface01?.id);

  // 3. Seed services for court's partner & ALL partners
  const partners = await prisma.user.findMany({ where: { role: "PARTNER" } });
  const partnerIds = new Set([court.partnerId, ...partners.map((p) => p.id)]);

  const sampleServices = [
    { name: "Nước suối Aquafina 500ml", categoryId: catMap.get("do-uong"), type: "PRODUCT", price: 10000, costPrice: 4000, unit: "chai" },
    { name: "Coca Cola 330ml", categoryId: catMap.get("do-uong"), type: "PRODUCT", price: 12000, costPrice: 7000, unit: "lon" },
    { name: "Sting Dâu Đỏ", categoryId: catMap.get("do-uong"), type: "PRODUCT", price: 12000, costPrice: 7000, unit: "chai" },
    { name: "Pocari Sweat Bù Khoáng", categoryId: catMap.get("do-uong"), type: "PRODUCT", price: 15000, costPrice: 9000, unit: "chai" },
    { name: "Redbull (Bò Húc Thái)", categoryId: catMap.get("do-uong"), type: "PRODUCT", price: 18000, costPrice: 10000, unit: "lon" },
    { name: "Trà Đào Cam Sả Tươi", categoryId: catMap.get("do-uong"), type: "PRODUCT", price: 25000, costPrice: 12000, unit: "ly" },
    
    { name: "Hộp Dưa Hấu Ướp Lạnh", categoryId: catMap.get("trai-cay"), type: "PRODUCT", price: 25000, costPrice: 12000, unit: "hộp" },
    { name: "Hộp Xoài Lắc Muối Ớt", categoryId: catMap.get("trai-cay"), type: "PRODUCT", price: 25000, costPrice: 12000, unit: "hộp" },
    { name: "Đĩa Trái Cây Thập Cẩm Lớn", categoryId: catMap.get("trai-cay"), type: "PRODUCT", price: 65000, costPrice: 35000, unit: "đĩa" },
    { name: "Chuối Sứ Thể Thao", categoryId: catMap.get("trai-cay"), type: "PRODUCT", price: 8000, costPrice: 4000, unit: "quả" },

    { name: "Bánh Mì Chả Pate", categoryId: catMap.get("do-an"), type: "PRODUCT", price: 20000, costPrice: 11000, unit: "ổ" },
    { name: "Mì Ly Cung Đình Bò Hầm", categoryId: catMap.get("do-an"), type: "PRODUCT", price: 15000, costPrice: 8000, unit: "ly" },
    { name: "Xúc Xích Nướng Đức", categoryId: catMap.get("do-an"), type: "PRODUCT", price: 15000, costPrice: 7000, unit: "cây" },

    { name: "Vớ Thể Thao Yonex", categoryId: catMap.get("dung-cu-the-thao"), type: "PRODUCT", price: 25000, costPrice: 12000, unit: "đôi" },
    { name: "Khăn Lạnh Ướp Hương", categoryId: catMap.get("dung-cu-the-thao"), type: "PRODUCT", price: 5000, costPrice: 2000, unit: "cái" },
    { name: "Khăn Bông Thấm Mồ Hôi", categoryId: catMap.get("dung-cu-the-thao"), type: "PRODUCT", price: 35000, costPrice: 18000, unit: "cái" },

    { name: "Thuê Vợt Cầu Lông Yonex Astrox", categoryId: catMap.get("cho-thue-dung-cu"), type: "RENTAL_SERVICE", price: 40000, costPrice: 0, unit: "lượt" },
    { name: "Thuê Vợt Pickleball Selkirk", categoryId: catMap.get("cho-thue-dung-cu"), type: "RENTAL_SERVICE", price: 60000, costPrice: 0, unit: "lượt" },

    { name: "Combo Đôi Năng Lượng (2 Suối + 1 Dưa Hấu + 2 Khăn)", categoryId: catMap.get("combo-the-thao"), type: "PRODUCT", price: 45000, costPrice: 22000, unit: "combo" },
    { name: "Combo Team 4 Đập Phá (4 Nước Ngọt + 1 Đĩa Trái Cây + 4 Khăn)", categoryId: catMap.get("combo-the-thao"), type: "PRODUCT", price: 110000, costPrice: 58000, unit: "combo" }
  ];

  for (const pid of partnerIds) {
    if (!pid) continue;
    for (const svc of sampleServices) {
      const existing = await prisma.service.findFirst({
        where: { partnerId: pid, name: svc.name }
      });
      if (!existing) {
        await prisma.service.create({
          data: {
            partnerId: pid,
            categoryId: svc.categoryId ?? null,
            name: svc.name,
            type: svc.type,
            price: svc.price,
            costPrice: svc.costPrice,
            unit: svc.unit,
            status: "ACTIVE",
            trackInventory: true
          }
        });
      }
    }
  }
  console.log("Services seeded for all partners!");

  // 4. Update booking bkbbmgy6aemsncwt86 (and unassigned bookings) to assign Sân Sala 1 - Sân 01
  const today = "2026-08-10";
  const nowStart = "22:00:00";
  const nowEnd = "23:00:00";

  if (surface01) {
    await prisma.booking.updateMany({
      where: {
        OR: [
          { id: "bkbbmgy6aemsncwt86" },
          { courtId: null },
          { courtSurfaceId: null }
        ]
      },
      data: {
        courtId: court.id,
        courtSurfaceId: surface01.id,
        bookingDate: new Date(`${today}T00:00:00Z`),
        startTime: new Date(`${today}T${nowStart}Z`),
        endTime: new Date(`${today}T${nowEnd}Z`),
        bookingStatus: "CONFIRMED"
      }
    });
    console.log(`Updated booking bkbbmgy6aemsncwt86 to Court ${court.name} - Surface ${surface01.name} (Time: ${today} 22:00 - 23:00)`);
  }

  console.log("=== COMPLETED ALL SEEDING & ASSIGNMENTS SUCCESSFULLY ===");
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
