import { prisma } from "../../config/db.js";

export type SocketUser = { id: string; role: "USER" | "PARTNER" | "RECIPIENT" | "ADMIN" };

/**
 * Booking rooms carry payment objects (customer id, QR payload, amounts) and invoice updates, so only the
 * customer, the court's partner, the staff assigned to that court and admins may join one.
 */
export async function canWatchBooking(user: SocketUser, bookingId: unknown) {
  if (typeof bookingId !== "string" || !bookingId) return false;
  if (user.role === "ADMIN") return true;
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { userId: true, courtId: true, court: { select: { partner: { select: { userId: true } } } } }
  });
  if (!booking) return false;
  if (booking.userId === user.id || booking.court.partner.userId === user.id) return true;
  if (user.role !== "RECIPIENT") return false;
  const staff = await prisma.user.findUnique({ where: { id: user.id }, select: { managedCourtId: true } });
  return staff?.managedCourtId === booking.courtId;
}
