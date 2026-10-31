import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { ConflictError, NotFoundError } from "../../shared/errors/AppError.js";
import { bookingBillInclude } from "../../shared/utils/bookingServices.js";
import { withBookingBill } from "./checkout.calculations.js";

/** What the customer still owes on a booking's bill: court and services, less voucher, deposit and counter payments. */
export async function bookingBalanceDue(bookingId: string, client: Prisma.TransactionClient = prisma) {
  const booking = await client.booking.findUnique({ where: { id: bookingId }, include: bookingBillInclude });
  if (!booking) throw new NotFoundError("Không tìm thấy đơn đặt sân");
  return withBookingBill(booking).bill.remainingAmount;
}

/**
 * A booking is finished by hand (Hoàn thành, Check-out, Xác nhận trả sân) only once its bill is paid; money still
 * owed is taken at the cashier, which finishes the booking itself when the bill is settled. The code tells the
 * screen to open the cashier for this booking.
 */
export async function assertNothingOwed(bookingId: string, client: Prisma.TransactionClient = prisma) {
  const due = await bookingBalanceDue(bookingId, client);
  if (due > 0) {
    throw new ConflictError(
      `Khách còn nợ ${new Intl.NumberFormat("vi-VN").format(due)}đ. Hãy thu tiền ở Thu ngân, đơn sẽ tự hoàn thành khi trả đủ.`,
      "BOOKING_BALANCE_DUE"
    );
  }
}
