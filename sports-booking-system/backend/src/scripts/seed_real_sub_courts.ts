import { PrismaClient } from "@prisma/client";
import { surfaceCode, surfaceName, normalizedSurfaceCode } from "../shared/utils/courtSurface.js";

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

      createdCount += await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM courts WHERE id = ${court.id} FOR UPDATE`;
        const existing = await tx.courtSurface.findMany({ where: { courtId: court.id } });
        const codes = new Set(existing.map((row) => normalizedSurfaceCode(row.code)));
        let added = 0;
        let sortOrder = existing.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;
        for (let i = 1; i <= 3; i++) {
          const code = surfaceCode(i);
          if (codes.has(code)) continue;
          await tx.courtSurface.create({ data: {
            courtId: court.id, code, name: surfaceName(courtName, i),
            capacity: capacityType, surface: surfaceType, size: sizeType, sortOrder: sortOrder++
          } });
          codes.add(code);
          added++;
        }
        await tx.court.update({ where: { id: court.id }, data: { courtCount: existing.length + added } });
        return added;
      });
    }
    console.log(`=== SUCCESS! Seeded ${createdCount} sub-courts (Sân 01, Sân 02, Sân 03) into \`court_surfaces\` table! ===`);
  } catch (err) {
    console.error("Failed to seed real sub-courts:", err);
  } finally {
    await prisma.$disconnect();
  }
}

seedRealSubCourts();
