import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { paymentService } from "./payment.service.js";

export const paymentController = {
  detail: asyncHandler(async (req, res) => sendSuccess(res, await paymentService.detail(req.user!.id, req.params.paymentId))),
  status: asyncHandler(async (req, res) => sendSuccess(res, await paymentService.status(req.user!.id, req.params.paymentId))),
  webhook: asyncHandler(async (req, res) => sendSuccess(res, await paymentService.webhook(req.params.provider, req.body, req.headers))),
  debugInfo: asyncHandler(async (req, res) => {
    const { prisma } = await import("../../config/db.js");
    const enumValues = await prisma.$queryRaw`
      SELECT enumlabel 
      FROM pg_enum 
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
      WHERE pg_type.typname = 'payment_method';
    `;
    const paymentTypeValues = await prisma.$queryRaw`
      SELECT enumlabel 
      FROM pg_enum 
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
      WHERE pg_type.typname = 'payment_type';
    `;
    const columnMetadata = await prisma.$queryRaw`
      SELECT table_name, column_name, data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name IN ('bookings', 'payments', 'booking_slots', 'booking_services', 'booking_vouchers');
    `;
    const firstUser = await prisma.user.findFirst();
    const firstCourt = await prisma.court.findFirst();
    return sendSuccess(res, { 
      enumValues, 
      paymentTypeValues, 
      columnMetadata,
      firstUser: firstUser ? { id: firstUser.id, length: firstUser.id.length } : null,
      firstCourt: firstCourt ? { id: firstCourt.id, length: firstCourt.id.length } : null
    });
  }),
  debugCheckout: asyncHandler(async (req, res) => {
    const { prisma } = await import("../../config/db.js");
    const { bookingService } = await import("../bookings/booking.service.js");
    try {
      const user = await prisma.user.findFirst({ where: { role: "USER" } });
      const court = await prisma.court.findFirst({ where: { approvalStatus: "APPROVED", activeStatus: "ACTIVE" } });
      if (!user || !court) {
        return res.status(404).json({ success: false, message: "User or Court not found" });
      }

      const bookingDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const result = await bookingService.checkout(user.id, {
        courtId: court.id,
        days: [
          { bookingDate, slots: [{ startTime: "08:00", endTime: "09:00" }] }
        ],
        paymentType: "DEPOSIT",
        note: "Debug checkout endpoint"
      });

      return res.json({ success: true, result });
    } catch (error: any) {
      console.error("DEBUG CHECKOUT FAILED:", error);
      try {
        const fs = await import("node:fs");
        fs.writeFileSync("debug-error.log", error.stack || String(error));
      } catch (writeErr) {
        console.error("Failed to write error log:", writeErr);
      }
      return res.status(400).json({ success: false, message: error.message, error });
    }
  })
};
