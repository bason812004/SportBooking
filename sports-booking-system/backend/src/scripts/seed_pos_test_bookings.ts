import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function hhmm(date: Date) {
  return date.toTimeString().slice(0, 5);
}

function localDay(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function timeOnly(hhmmStr: string) {
  return new Date(`1970-01-01T${hhmmStr}:00.000Z`);
}

async function main() {
  const court = await prisma.court.findFirst({
    where: { name: { contains: "Sala", mode: "insensitive" } },
    include: { surfaces: { where: { status: "ACTIVE" } } }
  });
  if (!court || court.surfaces.length < 3) {
    throw new Error("Không tìm thấy sân Sala hoặc thiếu sân con để seed test data");
  }

  const user = await prisma.user.findFirst({ where: { role: "USER" } });
  if (!user) throw new Error("Không tìm thấy user khách hàng để gán booking");

  const now = new Date();
  const stamp = Date.now();

  const scenarios = [
    {
      label: "Đang chơi (start -30' / end +30') — PHẢI hiện trong POS",
      surface: court.surfaces[0],
      start: new Date(now.getTime() - 30 * 60000),
      end: new Date(now.getTime() + 30 * 60000)
    },
    {
      label: "Chưa tới giờ (start +2h / end +3h) — KHÔNG được hiện trong POS",
      surface: court.surfaces[1],
      start: new Date(now.getTime() + 2 * 60 * 60000),
      end: new Date(now.getTime() + 3 * 60 * 60000)
    },
    {
      label: "Quá giờ trả sân (start -2h / end -1h, vẫn CONFIRMED) — PHẢI hiện trong POS",
      surface: court.surfaces[2],
      start: new Date(now.getTime() - 2 * 60 * 60000),
      end: new Date(now.getTime() - 1 * 60 * 60000)
    }
  ];

  for (const [index, s] of scenarios.entries()) {
    const bookingCode = `POS-TEST-${stamp}-${index + 1}`;
    const bookingDay = localDay(s.start);
    const booking = await prisma.booking.create({
      data: {
        bookingCode,
        userId: user.id,
        courtId: court.id,
        courtSurfaceId: s.surface.id,
        bookingDate: new Date(`${bookingDay}T00:00:00.000Z`),
        startTime: timeOnly(hhmm(s.start)),
        endTime: timeOnly(hhmm(s.end)),
        totalPrice: 120000,
        basePrice: 120000,
        subtotal: 120000,
        paymentMethod: "CASH",
        paymentStatus: "PAID",
        bookingStatus: "CONFIRMED",
        depositAmount: 120000
      }
    });
    console.log(`[OK] ${s.label}`);
    console.log(`     bookingId=${booking.id} surface=${s.surface.name} ${hhmm(s.start)}-${hhmm(s.end)}`);
  }

  console.log("\nXong. Vào /recipient/cashier hoặc /partner/cashier để kiểm tra.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
