import { z } from "zod";
const payment = z.object({ checkoutId: z.string().min(1).max(40), amount: z.number().finite().positive(), paymentMethod: z.enum(["CASH", "QR_TRANSFER", "BANK_TRANSFER", "E_WALLET"]), transactionId: z.string().max(120).optional() });
export const checkoutPaymentSchema = z.object({ body: payment });
export const checkoutPaymentByIdSchema = z.object({ params: z.object({ checkoutId: z.string().min(1).max(40) }), body: payment.omit({ checkoutId: true }) });
