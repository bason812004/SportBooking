import type { Request, Response } from "express";
import { BookingStatus } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { ForbiddenError } from "../../shared/errors/AppError.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { cashierService } from "./cashier.service.js";
import { resetAndSeed5TestBookings } from "../../scripts/reset_and_seed_test_bookings.js";

async function getPartnerId(userId: string, role: string): Promise<string | null> {
  if (role === "PARTNER") {
    const partner = await prisma.partnerProfile.findUnique({ where: { userId }, select: { id: true } });
    return partner?.id ?? null;
  }
  if (role === "RECIPIENT") {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { partnerId: true } });
    return user?.partnerId ?? null;
  }
  return null;
}

export const cashierController = {
  async getActiveBookings(req: Request, res: Response) {
    const partnerId = await getPartnerId(req.user!.id, req.user!.role);
    if (!partnerId) throw new ForbiddenError("Không có quyền truy cập dữ liệu thu ngân");
    const courtId = req.query.courtId as string | undefined;
    const bookings = await cashierService.getActiveBookings(partnerId, courtId);
    return sendSuccess(res, bookings);
  },

  async getBookingDetailForCashier(req: Request, res: Response) {
    const detail = await cashierService.getBookingDetailForCashier(req.params.bookingId);
    return sendSuccess(res, detail);
  },

  async addServiceToBooking(req: Request, res: Response) {
    const role = req.user!.role;
    const addedBy = role === "PARTNER" ? "PARTNER" : role === "RECIPIENT" ? "CASHIER" : "USER";
    const { serviceId, quantity } = req.body;
    const data = await cashierService.addServiceToBooking(req.params.bookingId, { serviceId, quantity: Number(quantity) || 1 }, addedBy);
    return sendSuccess(res, data, 200, "Thêm dịch vụ vào đơn thành công");
  },

  async updateBookingServiceQuantity(req: Request, res: Response) {
    const { quantity } = req.body;
    const data = await cashierService.updateBookingServiceQuantity(
      req.params.bookingId,
      req.params.serviceId,
      Number(quantity)
    );
    return sendSuccess(res, data, 200, "Cập nhật số lượng dịch vụ thành công");
  },

  async removeBookingService(req: Request, res: Response) {
    const data = await cashierService.removeBookingService(req.params.bookingId, req.params.serviceId);
    return sendSuccess(res, data, 200, "Xóa dịch vụ khỏi đơn thành công");
  },

  async returnRentalItem(req: Request, res: Response) {
    const { rentalItemId, status, notes } = req.body;
    const data = await cashierService.returnRentalItem({ rentalItemId, status, notes });
    return sendSuccess(res, data, 200, "Xử lý trả thiết bị cho thuê thành công");
  },

  async seedTestBookings(_req: Request, res: Response) {
    try {
      const createdBookings = await resetAndSeed5TestBookings();
      return sendSuccess(res, createdBookings, 201, `Đã dọn dẹp và tạo lại ${createdBookings.length} đơn mới hôm nay để test!`);
    } catch (error: any) {
      console.error("seedTestBookings error:", error);
      return res.status(200).json({ success: false, error: error.message || String(error) });
    }
  }
};
