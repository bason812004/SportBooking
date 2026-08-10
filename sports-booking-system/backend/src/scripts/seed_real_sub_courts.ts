import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function seedRealSubCourts() {
  console.log("=== SEEDING 3 REAL SUB-COURTS (SURFACES) FOR ALL COURTS IN DATABASE ===");
  try {
    const courts: any = await prisma.$queryRawUnsafe(`SELECT id, name, category_id FROM courts;`).catch(() => []);
    console.log(`Found ${courts.length} courts in database.`);

    let createdCount = 0;
    for (const court of courts) {
      const courtName = court.name ?? "";
      let surfaceType = "Cỏ nhân tạo 5cm";
      let capacityType = "7 người";
      let sizeType = "Tiêu chuẩn (20m x 40m)";

      if (courtName.toLowerCase().includes("pickleball")) {
        surfaceType = "Mặt sân Acrylic Decoturf 5 lớp";
        capacityType = "Đơn / Đôi 4 người";
        sizeType = "Tiêu chuẩn (6.1m x 13.4m)";
      } else if (courtName.toLowerCase().includes("tennis")) {
        surfaceType = "Mặt sân cứng Hard Court";
        capacityType = "Đơn / Đôi 4 người";
        sizeType = "Tiêu chuẩn (10.97m x 23.77m)";
      } else if (courtName.toLowerCase().includes("cầu lông") || courtName.toLowerCase().includes("badminton")) {
        surfaceType = "Thảm cao su PVC chuyên dụng";
        capacityType = "Đơn / Đôi 4 người";
        sizeType = "Tiêu chuẩn (6.1m x 13.4m)";
      } else if (courtName.toLowerCase().includes("bóng rổ") || courtName.toLowerCase().includes("basketball")) {
        surfaceType = "Sàn gỗ nẹp cao cấp";
        capacityType = "5v5 (10 người)";
        sizeType = "Tiêu chuẩn (15m x 28m)";
      }

      for (let i = 1; i <= 3; i++) {
        const code = `S0${i}`;
        const surfaceName = `${courtName} - Sân 0${i}`;
        const customId = `csf_${court.id}_0${i}`;

        await prisma.$executeRawUnsafe(
          `INSERT INTO court_surfaces (id, court_id, code, name, capacity, surface, size, status, sort_order, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', $8, NOW())
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = 'ACTIVE';`,
          customId,
          court.id,
          code,
          surfaceName,
          capacityType,
          surfaceType,
          sizeType,
          i
        ).catch(async (e) => {
          console.error(`[Insert Surface Error for ${customId}]:`, e?.message || e);
        });

        createdCount++;
      }
    }
    console.log(`=== SUCCESS! Seeded ${createdCount} sub-courts (Sân 01, Sân 02, Sân 03) into \`court_surfaces\` table! ===`);
  } catch (err) {
    console.error("Failed to seed real sub-courts:", err);
  } finally {
    await prisma.$disconnect();
  }
}

seedRealSubCourts();
