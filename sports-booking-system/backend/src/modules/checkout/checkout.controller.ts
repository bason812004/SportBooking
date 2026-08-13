import type { Request, Response } from "express";
import { prisma } from "../../config/db.js";
import { ForbiddenError } from "../../shared/errors/AppError.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { checkoutService } from "./checkout.service.js";

async function getPartnerId(userId: string): Promise<string> {
  const partner = await prisma.partnerProfile.findUnique({ where: { userId }, select: { id: true } });
  if (partner) return partner.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { partnerId: true, managedCourt: { select: { partnerId: true } } }
  });

  if (user?.partnerId) return user.partnerId;
  if (user?.managedCourt?.partnerId) return user.managedCourt.partnerId;

  throw new ForbiddenError("Tài khoản chưa có thông tin đối tác hoặc thu ngân");
}

export const checkoutController = {
  async getCheckoutByBooking(req: Request, res: Response) {
    const bookingId = req.params.bookingId;
    const checkoutData = await checkoutService.getOrCreateCheckout(bookingId);
    return sendSuccess(res, checkoutData);
  },

  async processPayment(req: Request, res: Response) {
    const { checkoutId, amount, paymentMethod, transactionId } = req.body;
    const result = await checkoutService.processPayment({
      checkoutId: checkoutId || req.params.checkoutId,
      amount: Number(amount),
      paymentMethod,
      transactionId
    });
    return sendSuccess(res, result, 200, "Thanh toán checkout thành công");
  },

  async listCheckouts(req: Request, res: Response) {
    const partnerId = await getPartnerId(req.user!.id);
    const checkouts = await checkoutService.listCheckouts(partnerId);
    return sendSuccess(res, checkouts);
  }
};
