import { prisma } from "../config/db.js";
import {
  BookingStatus,
  PaymentStatus,
  PaymentMethod,
  PaymentType,
  type UserRole
} from "@prisma/client";

function generateShortId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const time = Date.now().toString(36).slice(-6);
  return `${prefix}${rand}${time}`.slice(0, 20);
}

function timeToDate(timeStr: string): Date {
  return new Date(`1970-01-01T${timeStr}:00.000Z`);
}

// Curated high quality sport court images (Unsplash)
const SPORT_IMAGES: Record<string, string[]> = {
  // Bóng đá
  "bong-da": [
    "https://images.unsplash.com/photo-1529900240041-52c10c42ff8c?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1200&q=80"
  ],
  "bong-da-mini": [
    "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1529900240041-52c10c42ff8c?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=1200&q=80"
  ],
  // Cầu lông
  "cau-long": [
    "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1613918108466-292b78a8ef95?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1521537634581-0dced2fedc92?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1511067007772-9da29974ce45?auto=format&fit=crop&w=1200&q=80"
  ],
  // Quần vợt / Tennis
  "quan-vot": [
    "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1560012057-4372e14c5085?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1530915365347-e35b749a0381?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1200&q=80"
  ],
  "tennis": [
    "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1560012057-4372e14c5085?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1530915365347-e35b749a0381?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1200&q=80"
  ],
  // Bóng rổ
  "bong-ro": [
    "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1519766304817-4f37bda74a29?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1574623452334-1e0ac2b3ccb4?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1505666287802-931dc83948e9?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1200&q=80"
  ],
  // Bơi lội
  "boi-loi": [
    "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1519315901367-f34ff9154487?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1560089000-7433a4ebbd64?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=1200&q=80"
  ],
  // Pickleball
  "pickleball": [
    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1511067007772-9da29974ce45?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=80"
  ],
  // Bóng chuyền
  "bong-chuyen": [
    "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1592656094267-764a45160876?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1574623452334-1e0ac2b3ccb4?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=1200&q=80"
  ]
};

const DEFAULT_SPORT_IMAGES = [
  "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80"
];

const CUSTOMERS = [
  { name: "Nguyễn Văn Tuấn", phone: "0901234567", email: "tuan.nguyen@gmail.com" },
  { name: "Trần Thanh Sơn", phone: "0988112233", email: "son.tran@gmail.com" },
  { name: "Lê Minh Hoàng", phone: "0912345678", email: "hoang.le@gmail.com" },
  { name: "Phạm Quốc Bảo", phone: "0933445566", email: "bao.pham@gmail.com" },
  { name: "Hoàng Thị Mai", phone: "0977889900", email: "mai.hoang@gmail.com" },
  { name: "Đỗ Gia Huy", phone: "0945678901", email: "huy.do@gmail.com" },
  { name: "Vũ Đình Trọng", phone: "0966554433", email: "trong.vu@gmail.com" },
  { name: "Bùi Phương Thảo", phone: "0922334455", email: "thao.bui@gmail.com" }
];

async function main() {
  console.log("=== BẮT ĐẦU CẬP NHẬT HÌNH ẢNH SÂN VÀ TẠO ĐƠN ĐẶT CHO HẾT TUẦN NÀY (BẮT ĐẦU BATCH INSERT) ===");

  // 1. LẤY DANH SÁCH TẤT CẢ CÁC SÂN
  const courts = await prisma.court.findMany({
    include: {
      category: true,
      images: true,
      surfaces: {
        where: { status: "ACTIVE" },
        orderBy: { sortOrder: "asc" }
      }
    }
  });

  console.log(`-> Tìm thấy ${courts.length} sân.`);

  // 2. CẬP NHẬT HÌNH ẢNH CHO CÁC SÂN CHƯA ĐỦ 5 HÌNH
  console.log("\n--- [1/2] CẬP NHẬT HÌNH ẢNH SÂN & MẶT SÂN ---");
  const newImagesToInsert: any[] = [];
  const surfaceUpdates: Promise<any>[] = [];

  for (const court of courts) {
    const catSlug = court.category?.slug?.toLowerCase() || "";
    let images = SPORT_IMAGES[catSlug];
    if (!images || images.length === 0) {
      const catName = (court.category?.name || court.name).toLowerCase();
      if (catName.includes("bóng đá") || catName.includes("football") || catName.includes("futsal")) {
        images = SPORT_IMAGES["bong-da"];
      } else if (catName.includes("cầu lông") || catName.includes("badminton")) {
        images = SPORT_IMAGES["cau-long"];
      } else if (catName.includes("tennis") || catName.includes("quần vợt")) {
        images = SPORT_IMAGES["tennis"];
      } else if (catName.includes("bóng rổ") || catName.includes("basketball")) {
        images = SPORT_IMAGES["bong-ro"];
      } else if (catName.includes("bơi") || catName.includes("pool") || catName.includes("swim")) {
        images = SPORT_IMAGES["boi-loi"];
      } else if (catName.includes("pickleball")) {
        images = SPORT_IMAGES["pickleball"];
      } else if (catName.includes("bóng chuyền") || catName.includes("volleyball")) {
        images = SPORT_IMAGES["bong-chuyen"];
      } else {
        images = DEFAULT_SPORT_IMAGES;
      }
    }

    if (court.images.length < 5) {
      await prisma.courtImage.deleteMany({ where: { courtId: court.id } });
      for (let i = 0; i < images.length; i++) {
        newImagesToInsert.push({
          id: generateShortId("ci"),
          courtId: court.id,
          imageUrl: images[i],
          sortOrder: i + 1
        });
      }
    }

    // Cập nhật surface images
    for (let sIdx = 0; sIdx < court.surfaces.length; sIdx++) {
      const surface = court.surfaces[sIdx];
      const surfaceImg = images[sIdx % images.length];
      if (surface.imageUrl !== surfaceImg) {
        surfaceUpdates.push(
          prisma.courtSurface.update({
            where: { id: surface.id },
            data: { imageUrl: surfaceImg }
          })
        );
      }
    }
  }

  if (newImagesToInsert.length > 0) {
    await prisma.courtImage.createMany({ data: newImagesToInsert });
    console.log(`✔ Đã batch insert ${newImagesToInsert.length} hình ảnh sân thể thao.`);
  }
  if (surfaceUpdates.length > 0) {
    await Promise.all(surfaceUpdates);
    console.log(`✔ Đã cập nhật ảnh cho ${surfaceUpdates.length} mặt sân con.`);
  }

  // 3. ĐẢM BẢO KHÁCH HÀNG TEST TỒN TẠI
  console.log("\n--- [2/2] CHUẨN BỊ ĐƠN ĐẶT SÂN CHO HẾT TUẦN NÀY (21/10 -> 25/10/2026) ---");
  const customerUserMap = new Map<string, string>();
  for (const c of CUSTOMERS) {
    let u = await prisma.user.findFirst({
      where: { OR: [{ email: c.email }, { phone: c.phone }] }
    });

    if (!u) {
      u = await prisma.user.create({
        data: {
          id: generateShortId("u"),
          email: c.email,
          fullName: c.name,
          phone: c.phone,
          role: "USER" as UserRole
        }
      });
    }
    customerUserMap.set(c.phone, u.id);
  }

  const defaultUser = await prisma.user.findFirst({ where: { role: "USER" } });
  const defaultUserId = defaultUser?.id || Array.from(customerUserMap.values())[0];

  // 4. DANH SÁCH CÁC NGÀY CHO HẾT TUẦN NÀY
  const targetDates = [
    { dateStr: "2026-10-21", dayLabel: "Thứ Tư (Hôm nay)", isToday: true, isWeekend: false },
    { dateStr: "2026-10-22", dayLabel: "Thứ Năm", isToday: false, isWeekend: false },
    { dateStr: "2026-10-23", dayLabel: "Thứ Sáu", isToday: false, isWeekend: false },
    { dateStr: "2026-10-24", dayLabel: "Thứ Bảy (Cuối tuần)", isToday: false, isWeekend: true },
    { dateStr: "2026-10-25", dayLabel: "Chủ Nhật (Cuối tuần)", isToday: false, isWeekend: true }
  ];

  // Khung giờ trong ngày
  const timeSlots = [
    { start: "06:00", end: "07:30", priceModifier: 0.85, label: "Sáng sớm" },
    { start: "07:30", end: "09:00", priceModifier: 0.9, label: "Sáng" },
    { start: "09:00", end: "10:30", priceModifier: 0.9, label: "Sáng muộn" },
    { start: "14:00", end: "15:30", priceModifier: 0.95, label: "Đầu chiều" },
    { start: "15:30", end: "17:00", priceModifier: 1.0, label: "Chiều" },
    { start: "17:00", end: "18:30", priceModifier: 1.25, label: "Giờ cao điểm tối 1" },
    { start: "18:30", end: "20:00", priceModifier: 1.35, label: "Giờ cao điểm tối 2" },
    { start: "20:00", end: "21:30", priceModifier: 1.2, label: "Tối muộn" }
  ];

  const bookingsToInsert: any[] = [];
  const slotsToInsert: any[] = [];
  const paymentsToInsert: any[] = [];

  let bookingSeq = 1000;

  for (const day of targetDates) {
    const bookingDate = new Date(`${day.dateStr}T00:00:00.000Z`);

    for (const court of courts) {
      if (court.surfaces.length === 0) continue;

      // Đặt 2 mặt sân tiêu biểu cho mỗi sân
      const surfacesToBook = court.surfaces.slice(0, Math.min(2, court.surfaces.length));

      for (let sIdx = 0; sIdx < surfacesToBook.length; sIdx++) {
        const surface = surfacesToBook[sIdx];
        const selectedSlotIndexes = sIdx === 0 ? [0, 4, 6] : [1, 5, 7];

        for (const slotIdx of selectedSlotIndexes) {
          const slot = timeSlots[slotIdx];

          const custIdx = (court.name.length + slotIdx + sIdx) % CUSTOMERS.length;
          const customer = CUSTOMERS[custIdx];
          const userId = customerUserMap.get(customer.phone) || defaultUserId;

          let baseHourPrice = 180000;
          const cat = (court.category?.slug || "").toLowerCase();
          if (cat.includes("bong-da")) baseHourPrice = 280000;
          else if (cat.includes("tennis") || cat.includes("quan-vot")) baseHourPrice = 220000;
          else if (cat.includes("pickleball")) baseHourPrice = 190000;
          else if (cat.includes("cau-long")) baseHourPrice = 130000;
          else if (cat.includes("boi-loi")) baseHourPrice = 100000;

          if (day.isWeekend) baseHourPrice *= 1.2;
          const finalPrice = Math.round(baseHourPrice * slot.priceModifier * 1.5 / 1000) * 1000;

          let bookingStatus: BookingStatus = BookingStatus.CONFIRMED;
          let paymentStatus: PaymentStatus = PaymentStatus.PAID;
          let paymentMethod: PaymentMethod = PaymentMethod.ONLINE_GATEWAY;
          let checkedInAt: Date | null = null;
          let depositAmount = finalPrice;

          if (day.isToday) {
            if (slotIdx <= 1) {
              bookingStatus = BookingStatus.COMPLETED;
              paymentStatus = PaymentStatus.PAID;
              checkedInAt = new Date(`${day.dateStr}T${slot.start}:00.000Z`);
            } else if (slotIdx === 4) {
              bookingStatus = BookingStatus.IN_PROGRESS;
              paymentStatus = PaymentStatus.UNPAID;
              checkedInAt = new Date();
              depositAmount = 0;
              paymentMethod = PaymentMethod.CASH;
            } else {
              bookingStatus = BookingStatus.CONFIRMED;
              paymentStatus = PaymentStatus.PAID;
              paymentMethod = PaymentMethod.QR_TRANSFER;
            }
          } else {
            if (slotIdx % 2 === 0) {
              bookingStatus = BookingStatus.CONFIRMED;
              paymentStatus = PaymentStatus.PAID;
              paymentMethod = PaymentMethod.BANK_TRANSFER;
            } else {
              bookingStatus = BookingStatus.CONFIRMED;
              paymentStatus = PaymentStatus.PENDING;
              depositAmount = Math.round(finalPrice * 0.4 / 1000) * 1000;
              paymentMethod = PaymentMethod.CASH;
            }
          }

          bookingSeq++;
          const bId = generateShortId("b");
          const codeDate = day.dateStr.replace(/-/g, "").slice(2);
          const bookingCode = `BK${codeDate}-${court.id.slice(0, 5).toUpperCase()}-${sIdx}${slotIdx}-${bookingSeq}`;

          bookingsToInsert.push({
            id: bId,
            bookingCode: bookingCode,
            userId: userId,
            courtId: court.id,
            courtSurfaceId: surface.id,
            bookingDate: bookingDate,
            startTime: timeToDate(slot.start),
            endTime: timeToDate(slot.end),
            totalPrice: finalPrice,
            subtotal: finalPrice,
            basePrice: finalPrice,
            depositAmount: depositAmount,
            bookingStatus: bookingStatus,
            paymentStatus: paymentStatus,
            paymentMethod: paymentMethod,
            checkedInAt: checkedInAt,
            note: `Khách hàng: ${customer.name} (${customer.phone}) - Đặt sân ${surface.name} ca ${slot.start}-${slot.end}`
          });

          slotsToInsert.push({
            bookingId: bId,
            courtId: court.id,
            court_surface_id: surface.id,
            bookingDate: bookingDate,
            startTime: timeToDate(slot.start),
            endTime: timeToDate(slot.end),
            slotPrice: finalPrice
          });

          if (depositAmount > 0) {
            paymentsToInsert.push({
              bookingId: bId,
              userId: userId,
              amount: depositAmount,
              paymentMethod: paymentMethod,
              paymentType: depositAmount === finalPrice ? PaymentType.FULL_PAYMENT : PaymentType.DEPOSIT,
              paymentStatus: paymentStatus === PaymentStatus.PAID ? PaymentStatus.PAID : PaymentStatus.PENDING,
              paidAt: paymentStatus === PaymentStatus.PAID ? new Date() : null,
              notes: `Thanh toán cho đơn ${bookingCode}`
            });
          }
        }
      }
    }
  }

  console.log(`-> Chuẩn bị chèn ${bookingsToInsert.length} đơn đặt sân, ${slotsToInsert.length} slots, ${paymentsToInsert.length} payments.`);

  // BATCH INSERT THEO CHUNK 300 ĐỂ TỐI ƯU TỐC ĐỘ VÀ AN TOÀN
  const CHUNK_SIZE = 300;
  for (let i = 0; i < bookingsToInsert.length; i += CHUNK_SIZE) {
    const chunk = bookingsToInsert.slice(i, i + CHUNK_SIZE);
    await prisma.booking.createMany({ data: chunk, skipDuplicates: true });
    process.stdout.write(`✔ Đã chèn bookings: ${Math.min(i + CHUNK_SIZE, bookingsToInsert.length)}/${bookingsToInsert.length}\r`);
  }
  console.log("\n✔ Đã chèn xong toàn bộ Bookings!");

  for (let i = 0; i < slotsToInsert.length; i += CHUNK_SIZE) {
    const chunk = slotsToInsert.slice(i, i + CHUNK_SIZE);
    await prisma.bookingSlot.createMany({ data: chunk, skipDuplicates: true });
    process.stdout.write(`✔ Đã chèn booking slots: ${Math.min(i + CHUNK_SIZE, slotsToInsert.length)}/${slotsToInsert.length}\r`);
  }
  console.log("\n✔ Đã chèn xong toàn bộ Booking Slots!");

  for (let i = 0; i < paymentsToInsert.length; i += CHUNK_SIZE) {
    const chunk = paymentsToInsert.slice(i, i + CHUNK_SIZE);
    await prisma.payment.createMany({ data: chunk, skipDuplicates: true });
    process.stdout.write(`✔ Đã chèn payments: ${Math.min(i + CHUNK_SIZE, paymentsToInsert.length)}/${paymentsToInsert.length}\r`);
  }
  console.log("\n✔ Đã chèn xong toàn bộ Payments!");

  console.log(`\n======================================================`);
  console.log(`🎉 HOÀN TẤT THÀNH CÔNG!`);
  console.log(`✔ Đã cập nhật ảnh đẹp cho tất cả 41 sân và các mặt sân.`);
  console.log(`✔ Đã chèn ${bookingsToInsert.length} đơn đặt sân từ ngày 21/10 đến 25/10/2026.`);
  console.log(`======================================================\n`);
}

main()
  .catch((e) => {
    console.error("Lỗi khi chạy seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
