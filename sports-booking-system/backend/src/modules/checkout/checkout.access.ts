import { prisma } from "../../config/db.js";
import { ForbiddenError, NotFoundError } from "../../shared/errors/AppError.js";

export type CheckoutActor = { id: string; role: string };

export const checkoutAccessRepository = {
  async assertBooking(bookingId: string, actor: CheckoutActor, collect = false) {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { userId: true, courtId: true, court: { select: { partner: { select: { userId: true } } } } } });
    if (!booking) throw new NotFoundError("Booking không tồn tại");
    if (actor.role === "ADMIN") return;
    if (!collect && actor.role === "USER" && booking.userId === actor.id) return;
    if (actor.role === "PARTNER" && booking.court.partner.userId === actor.id) return;
    if (actor.role === "RECIPIENT") {
      const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { managedCourtId: true } });
      if (user?.managedCourtId === booking.courtId) return;
    }
    throw new ForbiddenError("Bạn không có quyền thao tác hóa đơn này");
  },
  async assertCheckout(checkoutId: string, actor: CheckoutActor) {
    const checkout = await prisma.checkout.findUnique({ where: { id: checkoutId }, select: { bookingId: true } });
    if (!checkout) throw new NotFoundError("Hóa đơn không tồn tại");
    await this.assertBooking(checkout.bookingId, actor, true);
  }
};
