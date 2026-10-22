import { PrismaClient, BookingStatus, PaymentMethod } from "@prisma/client";

const prisma = new PrismaClient();

function generateShortId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const time = Date.now().toString(36).slice(-6);
  return `${prefix}${rand}${time}`.slice(0, 20);
}

function timeToDate(time: string) {
  return new Date(`1970-01-01T${time}:00.000Z`);
}

async function main() {
  console.log("=== SEEDING TEST ACTIVE BOOKINGS ===");

  // 1. Get or create a test user
  let user = await prisma.user.findFirst({
    where: { role: "USER" }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        id: generateShortId("u"),
        email: "test.customer@example.com",
        fullName: "Nguyễn Văn A (Khách hàng test)",
        phone: "0901234567",
        role: "USER"
      }
    });
    console.log("Created test user:", user.fullName);
  } else {
    console.log("Using existing user:", user.fullName, `(ID: ${user.id})`);
  }

  // 2. Find available courts
  const courts = await prisma.court.findMany({
    take: 5,
    select: { id: true, name: true, partnerId: true }
  });

  if (courts.length === 0) {
    console.error("No courts found in database! Please seed courts first.");
    return;
  }

  console.log(`Found ${courts.length} courts.`);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDate = new Date(`${todayStr}T00:00:00.000Z`);

  const mockData = [
    {
      court: courts[0],
      userName: "Trần Thanh Sơn",
      phone: "0988112233",
      startTime: "14:00",
      endTime: "16:00",
      price: 300000,
      deposit: 100000,
      status: BookingStatus.CONFIRMED
    },
    {
      court: courts[1] || courts[0],
      userName: "Lê Minh Hoàng",
      phone: "0912345678",
      startTime: "14:30",
      endTime: "16:30",
      price: 450000,
      deposit: 200000,
      status: BookingStatus.IN_PROGRESS
    },
    {
      court: courts[2] || courts[0],
      userName: "Phạm Quốc Bảo",
      phone: "0933445566",
      startTime: "15:00",
      endTime: "17:00",
      price: 280000,
      deposit: 100000,
      status: BookingStatus.CONFIRMED
    }
  ];

  for (let i = 0; i < mockData.length; i++) {
    const item = mockData[i];
    
    // Find or create test customer user for variety
    let itemUser = await prisma.user.findFirst({ where: { phone: item.phone } });
    if (!itemUser) {
      itemUser = await prisma.user.create({
        data: {
          id: generateShortId("u"),
          email: `khach.${i + 1}@gmail.com`,
          fullName: item.userName,
          phone: item.phone,
          role: "USER"
        }
      });
    }

    const bookingId = generateShortId("bk");
    const bookingCode = `BK-TEST-${Date.now().toString().slice(-4)}-${i + 1}`;

    const booking = await prisma.booking.create({
      data: {
        id: bookingId,
        bookingCode: bookingCode,
        userId: itemUser.id,
        courtId: item.court.id,
        bookingDate: todayDate,
        startTime: timeToDate(item.startTime),
        endTime: timeToDate(item.endTime),
        totalPrice: item.price,
        subtotal: item.price,
        basePrice: item.price,
        depositAmount: item.deposit,
        bookingStatus: item.status,
        paymentMethod: PaymentMethod.CASH,
        note: "Đơn ảo tạo tự động để kiểm tra màn hình POS thu ngân"
      }
    });

    console.log(`Created booking #${booking.bookingCode} for court "${item.court.name}" (${item.userName})`);
  }

  console.log("=== SEED COMPLETED SUCCESSFULLY ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
