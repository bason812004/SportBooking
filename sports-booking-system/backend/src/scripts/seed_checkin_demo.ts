import { prisma } from "../config/db.js";

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
    include: { surfaces: { where: { status: "ACTIVE" }, orderBy: { code: "asc" } } }
  });
  if (!court || court.surfaces.length < 3) {
    throw new Error("Không tìm thấy sân Sala hoặc thiếu sân con để seed demo");
  }

  const users = await prisma.user.findMany({ where: { role: "USER" }, take: 10 });
  if (users.length === 0) throw new Error("Không tìm thấy user khách hàng để gán booking");
  const pickUser = (i: number) => users[i % users.length];

  const now = new Date();
  const stamp = Date.now();
  const [s1, s2, s3] = court.surfaces;

  type Scenario = {
    label: string;
    surface: (typeof court.surfaces)[number];
    start: Date;
    end: Date;
    checkedIn: boolean;
  };

  const scenarios: Scenario[] = [
    // Sân 01 — cả ngày: 3 khung giờ nối tiếp nhau
    { label: "S1 - Đã check-in, đang chơi", surface: s1, start: new Date(now.getTime() - 20 * 60000), end: new Date(now.getTime() + 40 * 60000), checkedIn: true },
    { label: "S1 - Sắp hết giờ, đã check-in", surface: s1, start: new Date(now.getTime() - 55 * 60000), end: new Date(now.getTime() + 5 * 60000), checkedIn: true },
    { label: "S1 - Tối nay (chưa tới giờ)", surface: s1, start: new Date(now.getTime() + 4 * 60 * 60000), end: new Date(now.getTime() + 5 * 60 * 60000), checkedIn: false },

    // Sân 02 — khách đến đúng giờ nhưng CHƯA check-in (để demo nút Check-in)
    { label: "S2 - Đã tới giờ, CHƯA check-in", surface: s2, start: new Date(now.getTime() - 10 * 60000), end: new Date(now.getTime() + 50 * 60000), checkedIn: false },
    { label: "S2 - Sắp tới giờ trong 20', chưa check-in", surface: s2, start: new Date(now.getTime() + 20 * 60000), end: new Date(now.getTime() + 80 * 60000), checkedIn: false },
    { label: "S2 - Chiều nay (chưa tới giờ)", surface: s2, start: new Date(now.getTime() + 3 * 60 * 60000), end: new Date(now.getTime() + 4 * 60 * 60000), checkedIn: false },

    // Sân 03 — quá giờ trả sân, khách vãng lai chưa checkout
    { label: "S3 - Quá giờ trả sân, đã check-in trước đó", surface: s3, start: new Date(now.getTime() - 90 * 60000), end: new Date(now.getTime() - 10 * 60000), checkedIn: true },
    { label: "S3 - Sáng sớm (đã xong từ lâu, KHÔNG check-in)", surface: s3, start: new Date(now.getTime() - 5 * 60 * 60000), end: new Date(now.getTime() - 4 * 60 * 60000), checkedIn: false },
    { label: "S3 - Tối muộn (chưa tới giờ)", surface: s3, start: new Date(now.getTime() + 6 * 60 * 60000), end: new Date(now.getTime() + 7 * 60 * 60000), checkedIn: false },
    { label: "S3 - Đêm khuya (chưa tới giờ)", surface: s3, start: new Date(now.getTime() + 8 * 60 * 60000), end: new Date(now.getTime() + 9 * 60 * 60000), checkedIn: false }
  ];

  for (const [index, s] of scenarios.entries()) {
    const bookingCode = `CHECKIN-DEMO-${stamp}-${index + 1}`;
    const bookingDay = localDay(s.start);
    const user = pickUser(index);
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
        depositAmount: 120000,
        checkedInAt: s.checkedIn ? new Date(s.start.getTime() + 1 * 60000) : null
      }
    });
    console.log(`[OK] ${s.label}`);
    console.log(`     bookingId=${booking.id} surface=${s.surface.name} ${hhmm(s.start)}-${hhmm(s.end)} checkedIn=${s.checkedIn} khách=${user.fullName}`);
  }

  console.log("\nXong. Vào /recipient/court-surfaces để check-in, hoặc /recipient/cashier để xem sân đang có khách.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
