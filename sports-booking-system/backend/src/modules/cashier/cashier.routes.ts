import { validate } from "../../middlewares/validate.middleware.js";
import { addServiceSchema, updateServiceSchema } from "./cashier.validation.js";
import { Router } from "express";
import { UserRole } from "@prisma/client";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { cashierController } from "./cashier.controller.js";
import { seedRecipientPostPaymentBookings } from "../../scripts/seed_recipient_post_payment_bookings.js";

export const cashierRoutes = Router();

cashierRoutes.get("/seed-test-bookings", asyncHandler(cashierController.seedTestBookings));
cashierRoutes.get("/reset-test-bookings", asyncHandler(cashierController.seedTestBookings));
cashierRoutes.get("/list-today", async (_req, res) => {
  const { prisma } = await import("../../config/db.js");
  const bookings = await prisma.booking.findMany({
    where: {
      courtId: "c0001",
      bookingDate: new Date("2026-09-24T00:00:00.000Z")
    },
    include: {
      user: { select: { fullName: true, phone: true } },
      courtSurface: { select: { name: true, code: true } },
      bookingSlots: true,
      bookingServices: true,
      checkout: true
    },
    orderBy: { startTime: "asc" }
  });
  res.json({ count: bookings.length, bookings });
});
// Endpoint tạo lịch đặt sân hôm nay cho Recipient test thanh toán sau
cashierRoutes.get("/seed-recipient-bookings", async (_req, res) => {
  try {
    const { prisma } = await import("../../config/db.js");
    const { ensureServiceTables } = await import("../services/service.repository.js");
    const { checkoutRepository } = await import("../checkout/checkout.repository.js");
    await ensureServiceTables();

    // 1. Lấy thông tin sân c0001 của Recipient
    const court = await prisma.court.findFirst({
      where: { id: "c0001" },
      select: {
        id: true,
        name: true,
        partnerId: true,
        surfaces: {
          where: { status: "ACTIVE" },
          orderBy: { sortOrder: "asc" }
        }
      }
    });

    if (!court || court.surfaces.length === 0) {
      return res.status(400).json({ success: false, error: "Không tìm thấy sân c0001 hoặc mặt sân" });
    }

    const surfaces = court.surfaces;
    const todayDate = new Date("2026-09-24T00:00:00.000Z");

    // 2. Danh sách 5 kịch bản test thanh toán sau đa dạng
    const scenarios = [
      {
        code: "BK-POSTPAY-01",
        customerName: "Nguyễn Văn Tuấn",
        phone: "0901234567",
        surfaceIndex: 0,
        startTime: "14:00:00",
        endTime: "15:30:00",
        price: 300000,
        deposit: 0,
        bookingStatus: "IN_PROGRESS" as const,
        paymentStatus: "UNPAID" as const,
        checkedInAt: new Date("2026-09-24T07:05:00.000Z"),
        note: "Khách đang đá Sân 1 - Thanh toán sau 100% tại quầy (Đã kèm nước giải khát)",
        addDemoServices: true
      },
      {
        code: "BK-POSTPAY-02",
        customerName: "Trần Thanh Sơn",
        phone: "0988112233",
        surfaceIndex: 1,
        startTime: "15:30:00",
        endTime: "17:00:00",
        price: 350000,
        deposit: 100000,
        bookingStatus: "CHECKOUT_PENDING" as const,
        paymentStatus: "PENDING" as const,
        checkedInAt: new Date("2026-09-24T08:30:00.000Z"),
        note: "Khách đã đá xong - Chờ thanh toán nốt phần còn lại 250.000đ tại quầy",
        addDemoServices: false
      },
      {
        code: "BK-POSTPAY-03",
        customerName: "Lê Minh Hoàng",
        phone: "0912345678",
        surfaceIndex: 2,
        startTime: "17:00:00",
        endTime: "18:30:00",
        price: 320000,
        deposit: 0,
        bookingStatus: "CONFIRMED" as const,
        paymentStatus: "UNPAID" as const,
        checkedInAt: null,
        note: "Đơn ca chiều tối - Khách chọn thanh toán sau khi đến sân",
        addDemoServices: false
      },
      {
        code: "BK-POSTPAY-04",
        customerName: "Phạm Quốc Bảo",
        phone: "0933445566",
        surfaceIndex: 0,
        startTime: "18:30:00",
        endTime: "20:00:00",
        price: 360000,
        deposit: 0,
        bookingStatus: "PENDING" as const,
        paymentStatus: "UNPAID" as const,
        checkedInAt: null,
        note: "Đơn mới đặt ca tối - Chờ nhân viên recipient bấm duyệt xác nhận",
        addDemoServices: false
      },
      {
        code: "BK-POSTPAY-05",
        customerName: "Hoàng Thị Mai",
        phone: "0977889900",
        surfaceIndex: 1,
        startTime: "20:00:00",
        endTime: "21:30:00",
        price: 300000,
        deposit: 0,
        bookingStatus: "CONFIRMED" as const,
        paymentStatus: "UNPAID" as const,
        checkedInAt: null,
        note: "Khách quen - Thanh toán sau qua quét mã QR PayOS/MBBank",
        addDemoServices: false
      }
    ];

    // Lấy hoặc tạo dịch vụ mẫu cho partner
    let service = await prisma.service.findFirst({
      where: { partnerId: court.partnerId, status: "ACTIVE" }
    });
    if (!service) {
      service = await prisma.service.create({
        data: {
          partnerId: court.partnerId,
          name: "Nước tăng lực Pocari Sweat 500ml",
          type: "PRODUCT",
          price: 20000,
          costPrice: 12000,
          unit: "chai",
          status: "ACTIVE"
        }
      });
    }

    const createdList = [];

    for (const sc of scenarios) {
      const surface = surfaces[sc.surfaceIndex % surfaces.length];

      let booking = await prisma.booking.findFirst({
        where: { courtId: "c0001", bookingCode: sc.code },
        include: {
          bookingSlots: true,
          bookingServices: true,
          checkout: true
        }
      });

      if (!booking) {
        let user = await prisma.user.findFirst({ where: { phone: sc.phone } });
        if (!user) {
          user = await prisma.user.create({
            data: {
              email: `khach.${sc.phone}@sportsbooking.test`,
              fullName: sc.customerName,
              phone: sc.phone,
              role: "USER"
            }
          });
        }

        booking = await prisma.booking.create({
          data: {
            bookingCode: sc.code,
            userId: user.id,
            courtId: "c0001",
            courtSurfaceId: surface.id,
            bookingDate: todayDate,
            startTime: new Date(`1970-01-01T${sc.startTime}.000Z`),
            endTime: new Date(`1970-01-01T${sc.endTime}.000Z`),
            totalPrice: sc.price,
            basePrice: sc.price,
            subtotal: sc.price,
            depositAmount: sc.deposit,
            bookingStatus: sc.bookingStatus,
            paymentStatus: sc.paymentStatus,
            paymentMethod: "CASH",
            checkedInAt: sc.checkedInAt,
            note: sc.note
          },
          include: {
            bookingSlots: true,
            bookingServices: true,
            checkout: true
          }
        });

        await prisma.bookingSlot.create({
          data: {
            bookingId: booking.id,
            courtId: "c0001",
            court_surface_id: surface.id,
            bookingDate: todayDate,
            startTime: new Date(`1970-01-01T${sc.startTime}.000Z`),
            endTime: new Date(`1970-01-01T${sc.endTime}.000Z`),
            slotPrice: sc.price
          }
        });

        let serviceTotal = 0;
        if (sc.addDemoServices && service) {
          serviceTotal = Number(service.price) * 2;
          await prisma.bookingService.create({
            data: {
              bookingId: booking.id,
              serviceId: service.id,
              quantity: 2,
              price: service.price,
              unitPrice: service.price,
              totalPrice: serviceTotal,
              status: "ACTIVE",
              addedBy: "RECIPIENT"
            }
          });
        }

        const totalAmount = sc.price + serviceTotal;
        const remainingAmount = Math.max(0, totalAmount - sc.deposit);
        const checkoutRecord = await prisma.checkout.create({
          data: {
            bookingId: booking.id,
            subtotalCourt: sc.price,
            subtotalService: serviceTotal,
            depositPaid: sc.deposit,
            amountPaid: sc.deposit,
            remainingAmount: remainingAmount,
            totalAmount: totalAmount,
            status: "PENDING",
            notes: sc.note
          }
        });

        createdList.push({
          bookingId: booking.id,
          bookingCode: booking.bookingCode,
          customer: sc.customerName,
          phone: sc.phone,
          surface: `${surface.name} (${surface.code})`,
          time: `${sc.startTime.slice(0, 5)} - ${sc.endTime.slice(0, 5)}`,
          bookingStatus: sc.bookingStatus,
          paymentStatus: sc.paymentStatus,
          courtFee: sc.price,
          serviceFee: serviceTotal,
          depositPaid: sc.deposit,
          remainingAmountToPay: remainingAmount,
          checkoutId: checkoutRecord.id,
          note: sc.note
        });
      } else {
        const checkout = booking.checkout;
        createdList.push({
          bookingId: booking.id,
          bookingCode: booking.bookingCode,
          customer: sc.customerName,
          phone: sc.phone,
          surface: `${surface.name} (${surface.code})`,
          time: `${sc.startTime.slice(0, 5)} - ${sc.endTime.slice(0, 5)}`,
          bookingStatus: booking.bookingStatus,
          paymentStatus: booking.paymentStatus,
          courtFee: Number(booking.totalPrice),
          serviceFee: checkout ? Number(checkout.subtotalService) : 0,
          depositPaid: Number(booking.depositAmount),
          remainingAmountToPay: checkout ? Number(checkout.remainingAmount) : Number(booking.totalPrice) - Number(booking.depositAmount),
          checkoutId: checkout?.id ?? null,
          note: booking.note
        });
      }
    }

    res.json({
      success: true,
      message: `Đã tạo thành công ${createdList.length} lịch đặt sân hôm nay cho Recipient test thanh toán sau!`,
      recipient: {
        courtId: "c0001",
        courtName: court.name,
        today: "2026-09-24"
      },
      bookings: createdList
    });
  } catch (err: any) {
    console.error("seed-recipient-bookings error:", err);
    res.json({ success: false, error: err.message, stack: err.stack });
  }
});

cashierRoutes.use(authMiddleware);

cashierRoutes.get("/bookings/active", requireRole(UserRole.PARTNER, UserRole.RECIPIENT, UserRole.ADMIN), asyncHandler(cashierController.getActiveBookings));
cashierRoutes.get("/bookings/:bookingId", requireRole(UserRole.PARTNER, UserRole.RECIPIENT, UserRole.USER, UserRole.ADMIN), asyncHandler(cashierController.getBookingDetailForCashier));

cashierRoutes.post("/bookings/:bookingId/services", requireRole(UserRole.PARTNER, UserRole.RECIPIENT, UserRole.USER, UserRole.ADMIN), validate(addServiceSchema), asyncHandler(cashierController.addServiceToBooking));
cashierRoutes.patch("/bookings/:bookingId/services/:serviceId", requireRole(UserRole.PARTNER, UserRole.RECIPIENT, UserRole.ADMIN), validate(updateServiceSchema), asyncHandler(cashierController.updateBookingServiceQuantity));
cashierRoutes.delete("/bookings/:bookingId/services/:serviceId", requireRole(UserRole.PARTNER, UserRole.RECIPIENT, UserRole.ADMIN), asyncHandler(cashierController.removeBookingService));

cashierRoutes.post("/bookings/:bookingId/check-in", requireRole(UserRole.PARTNER, UserRole.RECIPIENT, UserRole.ADMIN), asyncHandler(cashierController.checkInBooking));
cashierRoutes.post("/rentals/return", requireRole(UserRole.PARTNER, UserRole.RECIPIENT, UserRole.ADMIN), asyncHandler(cashierController.returnRentalItem));
