import type { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/response.js";
import { checkoutService } from "./checkout.service.js";

export const checkoutController = {
  async getCheckoutByBooking(req: Request, res: Response) {
    const bookingId = req.params.bookingId;
    const checkoutData = await checkoutService.getOrCreateCheckout(bookingId, req.user!);
    return sendSuccess(res, checkoutData);
  },

  async processPayment(req: Request, res: Response) {
    const { checkoutId, amount, paymentMethod, transactionId } = req.body;
    const result = await checkoutService.processPayment({
      checkoutId: checkoutId || req.params.checkoutId,
      amount: Number(amount),
      paymentMethod,
      transactionId
    }, req.user!);
    return sendSuccess(res, result, 200, "Thanh toán checkout thành công");
  }
};
