import { prisma } from "../config/db.js";

function generateShortId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const time = Date.now().toString(36).slice(-6);
  return `${prefix}${rand}${time}`.slice(0, 20);
}

function timeToDate(timeStr: string): Date {
  return new Date(`1970-01-01T${timeStr}:00.000Z`);
}

export async function seedRecipientPostPaymentBookings() {
  console.log("=== BẮT ĐẦU TẠO LỊCH ĐẶT SÂN HÔM NAY CHO RECIPIENT TEST THANH TOÁN SAU ===");

  // 1. Xác định Recipient và Sân quản lý
  const recipient = await prisma.user.findFirst({
    where: { role: "RECIPIENT" },
    select: {
      id: true,
      email: true,
      fullName: true,
      managedCourtId: true,
      partnerId: true,
      managedCourt: {
        select: {
          id: true,
          name: true,
          partnerId: true,
          surfaces: {
            where: { status: "ACTIVE" },
            orderBy: { sortOrder: "asc" }
          }
        }
      }
    }
  });

  if (!recipient || !recipient.managedCourtId || !recipient.managedCourt) {
    throw new Error("Không tìm thấy tài khoản RECIPIENT hoặc sân được phân công quản lý!");
  }

  const court = recipient.managedCourt;
  const partnerId = court.partnerId || recipient.partnerId || "pp0001";
  const surfaces = court.surfaces;

  if (surfaces.length === 0) {
    throw new Error(`Sân ${court.name} chưa có mặt sân (surfaces) nào!`);
  }

  console.log(`-> Recipient: ${recipient.fullName} (${recipient.email})`);
  console.log(`-> Sân quản lý: ${court.name} (ID: ${court.id})`);
  console.log(`-> Số mặt sân: ${surfaces.length}`);

  // Ngày hôm nay theo ngày địa phương / DB (2026-09-24)
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDate = new Date(`${todayStr}T00:00:00.000Z`);

  // 2. Dọn dẹp các đơn test cũ có tiền tố BK-POSTPAY- hoặc BK-TEST- trên sân này
  const oldTestBookings = await prisma.booking.findMany({
    where: {
      courtId: court.id,
      OR: [
        { bookingCode: { startsWith: "BK-POSTPAY-" } },
        { bookingCode: { startsWith: "BK-TEST-" } }
      ]
    },
    select: { id: true }
  });

  if (oldTestBookings.length > 0) {
    const oldIds = oldTestBookings.map((b) => b.id);
    await prisma.checkoutPayment.deleteMany({ where: { checkout: { bookingId: { in: oldIds } } } }).catch(() => {});
    await prisma.checkout.deleteMany({ where: { bookingId: { in: oldIds } } }).catch(() => {});
    await prisma.bookingSlot.deleteMany({ where: { bookingId: { in: oldIds } } }).catch(() => {});
    await prisma.bookingService.deleteMany({ where: { bookingId: { in: oldIds } } }).catch(() => {});
    await prisma.payment.deleteMany({ where: { bookingId: { in: oldIds } } }).catch(() => {});
    await prisma.booking.deleteMany({ where: { id: { in: oldIds } } }).catch(() => {});
    console.log(`-> Đã dọn dẹp ${oldIds.length} đơn test cũ.`);
  }

  // 3. Tìm hoặc tạo dịch vụ mẫu cho partnerId để test thanh toán sau kèm dịch vụ POS
  let demoServices = await prisma.service.findMany({
    where: { partnerId, status: "ACTIVE" },
    take: 3
  });

  if (demoServices.length === 0) {
    // Tạo 2 dịch vụ mẫu nếu chưa có
    const svc1 = await prisma.service.create({
      data: {
        partnerId,
        name: "Nước tăng lực Pocari Sweat 500ml",
        type: "PRODUCT",
        price: 20000,
        costPrice: 12000,
        unit: "chai",
        status: "ACTIVE"
      }
    });
    const svc2 = await prisma.service.create({
      data: {
        partnerId,
        name: "Thuê bóng đá tiêu chuẩn số 5",
        type: "RENTAL_SERVICE",
        price: 30000,
        costPrice: 0,
        unit: "lượt",
        status: "ACTIVE"
      }
    });
    demoServices = [svc1, svc2];
  }

  // 4. Danh sách các khách hàng và kịch bản test thanh toán sau
  const s1 = surfaces[0]?.id;
  const s2 = surfaces[1]?.id || surfaces[0]?.id;
  const s3 = surfaces[2]?.id || surfaces[0]?.id;

  const testScenarios = [
    {
      code: `BK-POSTPAY-01-${Date.now().toString().slice(-4)}`,
      customer: { name: "Nguyễn Văn Tuấn", phone: "0901234567" },
      surfaceId: s1,
      startTime: "14:00",
      endTime: "15:30",
      courtPrice: 300000,
      depositAmount: 0, // Thanh toán sau 100%
      bookingStatus: "IN_PROGRESS" as const,
      paymentStatus: "UNPAID" as const,
      checkedInAt: new Date(),
      note: "Khách đang đá tại Sân 1 - Thanh toán sau khi kết thúc trận (Đã kèm nước & bóng)",
      addServices: true
    },
    {
      code: `BK-POSTPAY-02-${Date.now().toString().slice(-4)}`,
      customer: { name: "Trần Thanh Sơn", phone: "0988112233" },
      surfaceId: s2,
      startTime: "15:30",
      endTime: "17:00",
      courtPrice: 350000,
      depositAmount: 100000, // Cọc 100k, thanh toán sau 250k
      bookingStatus: "CHECKOUT_PENDING" as const,
      paymentStatus: "PENDING" as const,
      checkedInAt: new Date(Date.now() - 3600000),
      note: "Đã đá xong - Chờ thanh toán phần còn lại 250.000đ tại quầy",
      addServices: false
    },
    {
      code: `BK-POSTPAY-03-${Date.now().toString().slice(-4)}`,
      customer: { name: "Lê Minh Hoàng", phone: "0912345678" },
      surfaceId: s3,
      startTime: "17:00",
      endTime: "18:30",
      courtPrice: 320000,
      depositAmount: 0, // Đặt trước trả sau
      bookingStatus: "CONFIRMED" as const,
      paymentStatus: "UNPAID" as const,
      checkedInAt: null,
      note: "Khách hẹn trả tiền mặt khi nhận sân chiều nay",
      addServices: false
    },
    {
      code: `BK-POSTPAY-04-${Date.now().toString().slice(-4)}`,
      customer: { name: "Phạm Quốc Bảo", phone: "0933445566" },
      surfaceId: s1,
      startTime: "19:00",
      endTime: "20:30",
      courtPrice: 360000,
      depositAmount: 0,
      bookingStatus: "PENDING" as const, // Chờ xác nhận
      paymentStatus: "UNPAID" as const,
      checkedInAt: null,
      note: "Đơn đặt mới ca tối - Chọn thanh toán sau tại quầy",
      addServices: false
    },
    {
      code: `BK-POSTPAY-05-${Date.now().toString().slice(-4)}`,
      customer: { name: "Hoàng Thị Mai", phone: "0977889900" },
      surfaceId: s2,
      startTime: "20:30",
      endTime: "22:00",
      courtPrice: 300000,
      depositAmount: 0,
      bookingStatus: "CONFIRMED" as const,
      paymentStatus: "UNPAID" as const,
      checkedInAt: null,
      note: "Khách quen đặt sân cố định - Thanh toán sau qua mã QR",
      addServices: false
    }
  ];

  const results = [];

  for (const sc of testScenarios) {
    // 4.1. Đảm bảo user khách hàng tồn tại
    let user = await prisma.user.findFirst({ where: { phone: sc.customer.phone } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: generateShortId("u"),
          email: `customer_${sc.customer.phone}@sportsbooking.test`,
          fullName: sc.customer.name,
          phone: sc.customer.phone,
          role: "USER"
        }
      });
    }

    // 4.2. Tạo Booking
    const bookingId = generateShortId("b");
    const booking = await prisma.booking.create({
      data: {
        id: bookingId,
        bookingCode: sc.code,
        userId: user.id,
        courtId: court.id,
        courtSurfaceId: sc.surfaceId,
        bookingDate: todayDate,
        startTime: timeToDate(sc.startTime),
        endTime: timeToDate(sc.endTime),
        totalPrice: sc.courtPrice,
        basePrice: sc.courtPrice,
        subtotal: sc.courtPrice,
        depositAmount: sc.depositAmount,
        bookingStatus: sc.bookingStatus,
        paymentStatus: sc.paymentStatus,
        paymentMethod: "CASH",
        checkedInAt: sc.checkedInAt,
        note: sc.note
      }
    });

    // 4.3. Tạo BookingSlot tương ứng (để hiển thị chuẩn trên cả Grid Lịch & Bảng)
    await prisma.bookingSlot.create({
      data: {
        bookingId: booking.id,
        courtId: court.id,
        court_surface_id: sc.surfaceId,
        bookingDate: todayDate,
        startTime: timeToDate(sc.startTime),
        endTime: timeToDate(sc.endTime),
        slotPrice: sc.courtPrice
      }
    });

    let serviceTotal = 0;
    // 4.4. Nếu có gắn dịch vụ (ví dụ đơn số 1 để test tính năng POS & thanh toán sau)
    if (sc.addServices && demoServices.length > 0) {
      for (let j = 0; j < Math.min(2, demoServices.length); j++) {
        const s = demoServices[j];
        const qty = j === 0 ? 2 : 1;
        const itemTotal = Number(s.price) * qty;
        serviceTotal += itemTotal;

        await prisma.bookingService.create({
          data: {
            id: generateShortId("bs"),
            bookingId: booking.id,
            serviceId: s.id,
            quantity: qty,
            price: s.price,
            unitPrice: s.price,
            totalPrice: itemTotal,
            status: "ACTIVE",
            addedBy: "RECIPIENT"
          }
        });
      }
    }

    // 4.5. Tạo sẵn bản ghi Checkout để recipient có thể bấm "Checkout và Thanh toán"
    const totalAmount = sc.courtPrice + serviceTotal;
    const remainingAmount = Math.max(0, totalAmount - sc.depositAmount);

    await prisma.checkout.create({
      data: {
        bookingId: booking.id,
        subtotalCourt: sc.courtPrice,
        subtotalService: serviceTotal,
        depositPaid: sc.depositAmount,
        amountPaid: sc.depositAmount,
        remainingAmount: remainingAmount,
        totalAmount: totalAmount,
        status: "PENDING",
        notes: sc.note
      }
    });

    // Tìm surface name
    const surf = surfaces.find((s) => s.id === sc.surfaceId);

    results.push({
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
      customerName: user.fullName,
      phone: user.phone,
      courtName: court.name,
      surfaceName: surf ? `${surf.name} (${surf.code})` : "Sân tiêu chuẩn",
      time: `${sc.startTime} - ${sc.endTime}`,
      courtFee: sc.courtPrice,
      serviceFee: serviceTotal,
      depositPaid: sc.depositAmount,
      remainingToPay: remainingAmount,
      bookingStatus: sc.bookingStatus,
      paymentStatus: sc.paymentStatus,
      note: sc.note
    });
  }

  console.log(`=== ĐÃ TẠO THÀNH CÔNG ${results.length} ĐƠN ĐẶT SÂN THANH TOÁN SAU CHO RECIPIENT ===`);
  return {
    recipient: {
      id: recipient.id,
      email: recipient.email,
      name: recipient.fullName,
      courtName: court.name
    },
    today: todayStr,
    count: results.length,
    bookings: results
  };
}
