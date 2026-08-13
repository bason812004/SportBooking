import { prisma } from "../config/db.js";

function generateShortId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const time = Date.now().toString(36).slice(-6);
  return `${prefix}${rand}${time}`.slice(0, 20);
}

function timeToDate(timeStr: string) {
  return new Date(`1970-01-01T${timeStr}:00.000Z`);
}

export async function resetAndSeed5TestBookings() {
  console.log("=== BẮT ĐẦU DỌN DẸP VÀ TẠO 5 ĐƠN ẢO MỚI HÔM NAY ===");

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDate = new Date(`${todayStr}T00:00:00.000Z`);

  // 1. Dọn dẹp tất cả đơn test BK-TEST- hoặc đơn của ngày hôm nay bằng SQL trực tiếp
  const existingBookings = await prisma.booking.findMany({
    where: {
      OR: [
        { bookingCode: { startsWith: "BK-TEST-" } },
        { bookingDate: todayDate }
      ]
    },
    select: { id: true }
  });

  const bookingIds = existingBookings.map((b) => b.id);
  console.log(`Tìm thấy ${bookingIds.length} đơn cần dọn dẹp...`);

  if (bookingIds.length > 0) {
    const idsStr = bookingIds.map((id) => `'${id}'`).join(",");
    await prisma.$executeRawUnsafe(`DELETE FROM rental_items WHERE booking_service_id IN (SELECT id FROM booking_services WHERE booking_id IN (${idsStr}))`).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM booking_services WHERE booking_id IN (${idsStr})`).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM payments WHERE booking_id IN (${idsStr})`).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM checkouts WHERE booking_id IN (${idsStr})`).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM bookings WHERE id IN (${idsStr})`).catch(() => {});
    console.log("-> Đã xóa sạch dữ liệu đơn cũ bằng SQL.");
  }

  // 2. Lấy 5 sân sẵn có trong DB
  const courts = await prisma.court.findMany({
    take: 5,
    select: { id: true, name: true, partnerId: true }
  });

  if (courts.length === 0) {
    console.error("Không tìm thấy sân nào trong database!");
    return [];
  }

  // 3. Khách hàng mẫu & Khung giờ hiện tại hôm nay
  const mockCustomers = [
    { name: "Nguyễn Văn Tuấn", phone: "0901234567", time: ["14:00", "16:00"], deposit: 100000, note: "Đặt cố định sân 1" },
    { name: "Trần Thanh Sơn", phone: "0988112233", time: ["14:30", "16:30"], deposit: 150000, note: "Cần lấy thêm 2 Pocari" },
    { name: "Lê Minh Hoàng", phone: "0912345678", time: ["15:00", "17:00"], deposit: 100000, note: "Khách quen CLB" },
    { name: "Phạm Quốc Bảo", phone: "0933445566", time: ["15:30", "17:30"], deposit: 200000, note: "Thuê 2 đôi vợt cầu lông" },
    { name: "Hoàng Thị Mai", phone: "0977889900", time: ["16:00", "18:00"], deposit: 100000, note: "Thanh toán chuyển khoản" }
  ];

  const createdList = [];

  for (let i = 0; i < Math.min(5, courts.length); i++) {
    const court = courts[i];
    const cust = mockCustomers[i];

    // Ensure User exists
    let user = await prisma.user.findFirst({ where: { phone: cust.phone } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: generateShortId("u"),
          email: `khach.test.${i + 1}.${Date.now()}@gmail.com`,
          fullName: cust.name,
          phone: cust.phone,
          role: "USER"
        }
      });
    }

    const bookingId = generateShortId("bk");
    const bookingCode = `BK-TEST-${String(i + 1).padStart(2, "0")}-${Date.now().toString().slice(-4)}`;

    const booking = await prisma.booking.create({
      data: {
        id: bookingId,
        bookingCode,
        userId: user.id,
        courtId: court.id,
        bookingDate: todayDate,
        startTime: timeToDate(cust.time[0]),
        endTime: timeToDate(cust.time[1]),
        totalPrice: 300000,
        subtotal: 300000,
        basePrice: 300000,
        depositAmount: cust.deposit,
        bookingStatus: "CONFIRMED",
        paymentMethod: "CASH",
        note: cust.note
      }
    });

    createdList.push({
      id: booking.id,
      code: booking.bookingCode,
      court: court.name,
      customer: cust.name,
      time: `${cust.time[0]} - ${cust.time[1]}`
    });
  }

  console.log(`=== ĐÃ TẠO THÀNH CÔNG ${createdList.length} ĐƠN ẢO HÔM NAY ===`);
  return createdList;
}

// Execute directly if run via CLI
if (process.argv[1]?.includes("reset_and_seed_test_bookings")) {
  resetAndSeed5TestBookings()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
