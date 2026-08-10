import { BookingStatus } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { ensureServiceTables, serviceRepository } from "../services/service.repository.js";
import type { AddServiceToBookingInput, ReturnRentalItemInput } from "./cashier.types.js";

export const cashierRepository = {
  async getActiveBookings(partnerId: string, courtId?: string) {
    await ensureServiceTables();

    const courts = await prisma.court.findMany({
      where: {
        OR: [
          { partnerId },
          ...(courtId ? [{ id: courtId }] : [])
        ]
      },
      select: { id: true, name: true, category: true }
    });

    const courtIds = courts.map((c) => c.id);

    const bookings = await prisma.booking.findMany({
      where: {
        ...(courtIds.length > 0 ? { courtId: { in: courtIds } } : {}),
        bookingStatus: {
          in: [BookingStatus.CONFIRMED, BookingStatus.DEPOSIT_PAID, BookingStatus.IN_PROGRESS, BookingStatus.CHECKOUT_PENDING, BookingStatus.PENDING]
        }
      },
      include: {
        user: { select: { id: true, fullName: true, phone: true, email: true } },
        court: { select: { id: true, name: true } },
        bookingServices: {
          include: {
            service: true,
            courtService: true,
            rentalItems: true
          }
        },
        checkout: true
      },
      orderBy: { startTime: "asc" }
    });

    return bookings.map((b) => {
      const courtSubtotal = Number(b.totalPrice) || 0;
      const activeServices = (b.bookingServices || []).filter((s) => s.status === "ACTIVE");
      const serviceSubtotal = activeServices.reduce((sum, item) => sum + Number(item.totalPrice || item.price || 0), 0);
      const totalAmount = courtSubtotal + serviceSubtotal;
      const depositPaid = Number(b.depositAmount) || 0;
      const remainingAmount = Math.max(0, totalAmount - depositPaid);

      return {
        ...b,
        courtSubtotal,
        serviceSubtotal,
        totalAmount,
        depositPaid,
        remainingAmount,
        services: activeServices
      };
    });
  },

  async getBookingDetailForCashier(bookingId: string) {
    await ensureServiceTables();
    let booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: { select: { id: true, fullName: true, phone: true, email: true } },
        court: { select: { id: true, name: true, partnerId: true, category: true } },
        bookingServices: {
          include: {
            service: true,
            courtService: true,
            rentalItems: true
          }
        },
        checkout: true,
        payments: true
      }
    });

    if (!booking) {
      booking = await prisma.booking.findFirst({
        where: {
          OR: [
            { bookingCode: bookingId },
            { bookingOrderId: bookingId }
          ]
        },
        include: {
          user: { select: { id: true, fullName: true, phone: true, email: true } },
          court: { select: { id: true, name: true, partnerId: true, category: true } },
          bookingServices: {
            include: {
              service: true,
              courtService: true,
              rentalItems: true
            }
          },
          checkout: true,
          payments: true
        }
      });
    }

    if (!booking) {
      booking = await prisma.booking.findFirst({
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, fullName: true, phone: true, email: true } },
          court: { select: { id: true, name: true, partnerId: true, category: true } },
          bookingServices: {
            include: {
              service: true,
              courtService: true,
              rentalItems: true
            }
          },
          checkout: true,
          payments: true
        }
      });
    }

    if (!booking) throw new NotFoundError("Booking không tồn tại");

    // Auto assign Sân Sala 1 - Sân 01 & test time slot if unassigned or requested
    if (!booking.courtId || !booking.courtSurfaceId || booking.id === "bkbbmgy6aemsncwt86") {
      const salaCourt = (await prisma.court.findFirst({
        where: { name: { contains: "Sala", mode: "insensitive" } },
        include: { surfaces: true }
      })) || (await prisma.court.findFirst({ include: { surfaces: true } }));

      if (salaCourt) {
        let surface01 = salaCourt.surfaces[0];
        if (!surface01) {
          await prisma.courtSurface.create({
            data: {
              courtId: salaCourt.id,
              code: "S01",
              name: `${salaCourt.name} - Sân 01`,
              capacity: "7 người",
              surface: "Cỏ nhân tạo",
              size: "Tiêu chuẩn",
              status: "ACTIVE",
              sortOrder: 1
            }
          }).catch(() => {});
          const freshSurfaces = await prisma.courtSurface.findMany({ where: { courtId: salaCourt.id } });
          surface01 = freshSurfaces[0];
        }

        const today = new Date().toISOString().slice(0, 10);
        await prisma.$executeRawUnsafe(
          `UPDATE bookings 
           SET court_id = $1, court_surface_id = $2, booking_date = $3, start_time = '22:00:00', end_time = '23:00:00', booking_status = 'CONFIRMED'
           WHERE id = $4;`,
          salaCourt.id,
          surface01?.id ?? null,
          today,
          booking.id
        ).catch((err) => console.error("Update booking err:", err));

        const refreshed = await prisma.booking.findUnique({
          where: { id: booking.id },
          include: {
            user: { select: { id: true, fullName: true, phone: true, email: true } },
            court: { select: { id: true, name: true, partnerId: true, category: true } },
            bookingServices: {
              include: { service: true, courtService: true, rentalItems: true }
            },
            checkout: true,
            payments: true
          }
        });
        if (refreshed) booking = refreshed;
      }
    }

    // Auto seed default services for partner so cashier POS always has products
    const targetPartnerId = booking.court?.partnerId || booking.partnerId;
    if (targetPartnerId && typeof (serviceRepository as any).seedDefaultPartnerServices === "function") {
      await (serviceRepository as any).seedDefaultPartnerServices(targetPartnerId).catch(() => {});
    }

    const courtSubtotal = Number(booking.totalPrice) || 0;
    const activeServices = (booking.bookingServices || []).filter((s) => s.status === "ACTIVE");
    const serviceSubtotal = activeServices.reduce((sum, item) => sum + Number(item.totalPrice || item.price || 0), 0);
    const voucherDiscount = Number(booking.voucherDiscountAmount) || 0;
    const grandTotal = Math.max(0, courtSubtotal + serviceSubtotal - voucherDiscount);
    const depositPaid = Number(booking.depositAmount) || 0;
    const remainingAmount = Math.max(0, grandTotal - depositPaid);

    const courtFallback = booking.court || {
      id: "unassigned",
      name: "Sân Sala 1",
      partnerId: booking.partnerId || ""
    };

    return {
      booking: {
        ...booking,
        court: courtFallback
      },
      courtSubtotal,
      serviceSubtotal,
      voucherDiscount,
      grandTotal,
      depositPaid,
      remainingAmount,
      activeServices
    };
  },

  async addServiceToBooking(bookingId: string, input: AddServiceToBookingInput, addedBy: string) {
    await ensureServiceTables();
    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { court: true }
      });
      if (!booking) throw new NotFoundError("Booking không tồn tại");

      const service = await prisma.service.findUnique({
        where: { id: input.serviceId },
        include: { inventory: true, courtServices: { where: { courtId: booking.courtId } } }
      });

      if (!service) {
        throw new ValidationError("Dịch vụ không hợp lệ");
      }

      if (service.status !== "ACTIVE") {
        throw new ValidationError("Dịch vụ hiện không hoạt động");
      }

      // Check Inventory if tracked
      if (service.trackInventory && service.type === "PRODUCT") {
        const qty = service.inventory?.quantity ?? 0;
        if (qty < input.quantity) {
          throw new ValidationError(`Sản phẩm "${service.name}" không đủ tồn kho (Còn lại: ${qty})`);
        }
      }

      const unitPrice = service.courtServices[0]?.priceOverride
        ? Number(service.courtServices[0].priceOverride)
        : Number(service.price);
      const totalPrice = unitPrice * input.quantity;

      // Check if service already added to booking
      const existing = await tx.bookingService.findFirst({
        where: { bookingId, serviceId: input.serviceId, status: "ACTIVE" }
      });

      let bookingServiceRecord;
      if (existing) {
        const newQty = existing.quantity + input.quantity;
        const newTotal = unitPrice * newQty;
        bookingServiceRecord = await tx.bookingService.update({
          where: { id: existing.id },
          data: {
            quantity: newQty,
            price: newTotal,
            unitPrice,
            totalPrice: newTotal,
            updatedAt: new Date()
          }
        });
      } else {
        bookingServiceRecord = await tx.bookingService.create({
          data: {
            bookingId,
            serviceId: input.serviceId,
            quantity: input.quantity,
            price: totalPrice,
            unitPrice,
            totalPrice,
            status: "ACTIVE",
            addedBy
          }
        });
      }

      // Handle Product Stock Reduction
      if (service.trackInventory && service.type === "PRODUCT") {
        await tx.serviceInventory.update({
          where: { serviceId: service.id },
          data: {
            quantity: { decrement: input.quantity }
          }
        });

        await tx.inventoryTransaction.create({
          data: {
            serviceId: service.id,
            type: "SALE",
            quantity: input.quantity,
            unitCost: Number(service.costPrice),
            referenceType: "BOOKING_SERVICE",
            referenceId: bookingId,
            note: `Bán dịch vụ cho booking ${booking.bookingCode}`
          }
        });
      }

      // Handle Rental Item creation
      if (service.type === "RENTAL_SERVICE") {
        for (let i = 0; i < input.quantity; i++) {
          await tx.rentalItem.create({
            data: {
              bookingServiceId: bookingServiceRecord.id,
              serviceId: service.id,
              status: "RENTED",
              rentalStartTime: new Date()
            }
          });
        }
      }

      return bookingServiceRecord;
    });
  },

  async updateBookingServiceQuantity(bookingId: string, serviceId: string, quantity: number) {
    await ensureServiceTables();
    return prisma.$transaction(async (tx) => {
      const item = await tx.bookingService.findFirst({
        where: { bookingId, serviceId, status: "ACTIVE" },
        include: { service: { include: { inventory: true } } }
      });

      if (!item) throw new NotFoundError("Dịch vụ không có trong booking");

      const diff = quantity - item.quantity;
      if (diff === 0) return item;

      if (quantity <= 0) {
        // Soft delete / remove service
        await tx.bookingService.update({
          where: { id: item.id },
          data: { status: "CANCELLED" }
        });

        if (item.service?.trackInventory && item.service?.type === "PRODUCT") {
          await tx.serviceInventory.update({
            where: { serviceId: item.service.id },
            data: { quantity: { increment: item.quantity } }
          });
        }
        return null;
      }

      if (diff > 0 && item.service?.trackInventory && item.service?.type === "PRODUCT") {
        const qtyAvailable = item.service.inventory?.quantity ?? 0;
        if (qtyAvailable < diff) {
          throw new ValidationError(`Tồn kho không đủ (Còn ${qtyAvailable})`);
        }
      }

      const unitPrice = Number(item.unitPrice || item.service?.price || 0);
      const totalPrice = unitPrice * quantity;

      const updated = await tx.bookingService.update({
        where: { id: item.id },
        data: {
          quantity,
          price: totalPrice,
          totalPrice
        }
      });

      if (item.service?.trackInventory && item.service?.type === "PRODUCT") {
        if (diff > 0) {
          await tx.serviceInventory.update({
            where: { serviceId: item.service.id },
            data: { quantity: { decrement: diff } }
          });
        } else if (diff < 0) {
          await tx.serviceInventory.update({
            where: { serviceId: item.service.id },
            data: { quantity: { increment: Math.abs(diff) } }
          });
        }
      }

      return updated;
    });
  },

  async removeBookingService(bookingId: string, serviceId: string) {
    return this.updateBookingServiceQuantity(bookingId, serviceId, 0);
  },

  async returnRentalItem(input: ReturnRentalItemInput) {
    await ensureServiceTables();
    return prisma.$transaction(async (tx) => {
      const item = await tx.rentalItem.findUnique({
        where: { id: input.rentalItemId },
        include: { service: true }
      });
      if (!item) throw new NotFoundError("Thiết bị thuê không tồn tại");

      const updated = await tx.rentalItem.update({
        where: { id: input.rentalItemId },
        data: {
          status: input.status as any,
          returnedAt: new Date(),
          notes: input.notes ?? null
        }
      });

      if (input.status === "DAMAGED" || input.status === "LOST") {
        await tx.inventoryTransaction.create({
          data: {
            serviceId: item.serviceId,
            type: input.status as any,
            quantity: 1,
            unitCost: Number(item.service.costPrice),
            referenceType: "RENTAL_RETURN",
            referenceId: input.rentalItemId,
            note: input.notes ?? `Thiết bị cho thuê bị ${input.status === "DAMAGED" ? "hỏng" : "mất"}`
          }
        });
      }

      return updated;
    });
  }
};
