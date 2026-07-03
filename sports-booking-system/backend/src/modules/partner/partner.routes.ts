import { Router } from "express";
import multer from "multer";
import { UserRole } from "@prisma/client";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  courtWriteSchema,
  bookingQuerySchema,
  blogWriteSchema,
  calendarQuerySchema,
  imageSchema,
  imageOrderSchema,
  bookingContinueSchema,
  bookingExtendSchema,
  walkInBookingSchema,
  priceWriteSchema,
  operationsQuerySchema,
  profileUpdateSchema,
  serviceWriteSchema,
  tournamentWriteSchema,
  voucherWriteSchema
} from "./partner.validation.js";
import { partnerController } from "./partner.controller.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 } });
export const partnerRoutes = Router();

partnerRoutes.use(authMiddleware, requireRole(UserRole.PARTNER));
partnerRoutes.get("/dashboard", partnerController.dashboard);
partnerRoutes.get("/profile", partnerController.profile);
partnerRoutes.put("/profile", validate(profileUpdateSchema), partnerController.updateProfile);
partnerRoutes.get("/courts", partnerController.courts);
partnerRoutes.post("/courts", validate(courtWriteSchema), partnerController.createCourt);
partnerRoutes.get("/courts/:id", partnerController.courtDetail);
partnerRoutes.put("/courts/:id", validate(courtWriteSchema.partial()), partnerController.updateCourt);
partnerRoutes.delete("/courts/:id", partnerController.deactivateCourt);
partnerRoutes.post("/courts/:id/images", upload.single("image"), validate(imageSchema), partnerController.addImage);
partnerRoutes.delete("/images/:imageId", partnerController.deleteImage);
partnerRoutes.put("/courts/:id/images/order", validate(imageOrderSchema), partnerController.reorderImages);
partnerRoutes.post("/courts/:id/prices", validate(priceWriteSchema), partnerController.addPrice);
partnerRoutes.put("/prices/:priceId", validate(priceWriteSchema.partial()), partnerController.updatePrice);
partnerRoutes.delete("/prices/:priceId", partnerController.deletePrice);
partnerRoutes.post("/courts/:id/services", validate(serviceWriteSchema), partnerController.addService);
partnerRoutes.put("/services/:serviceId", validate(serviceWriteSchema.partial()), partnerController.updateService);
partnerRoutes.delete("/services/:serviceId", partnerController.deleteService);
partnerRoutes.get("/bookings", validate(bookingQuerySchema), partnerController.bookings);
partnerRoutes.get("/operations", validate(operationsQuerySchema), partnerController.operations);
partnerRoutes.post("/operations/walk-in-booking", validate(walkInBookingSchema), partnerController.createWalkInBooking);
partnerRoutes.put("/bookings/:id/confirm", partnerController.confirm);
partnerRoutes.put("/bookings/:id/reject", partnerController.reject);
partnerRoutes.put("/bookings/:id/complete", partnerController.complete);
partnerRoutes.put("/bookings/:id/no-show", partnerController.noShow);
partnerRoutes.post("/bookings/:id/extend", validate(bookingExtendSchema), partnerController.extendBooking);
partnerRoutes.post("/bookings/:id/early-check-in", partnerController.earlyCheckInBooking);
partnerRoutes.post("/bookings/:id/early-check-out", partnerController.earlyCheckOutBooking);
partnerRoutes.post("/bookings/:id/continue", validate(bookingContinueSchema), partnerController.continueBooking);
partnerRoutes.get("/statistics/revenue", partnerController.revenue);
partnerRoutes.get("/calendar", validate(calendarQuerySchema), partnerController.calendar);
partnerRoutes.get("/vouchers", partnerController.vouchers);
partnerRoutes.post("/vouchers", validate(voucherWriteSchema), partnerController.createVoucher);
partnerRoutes.get("/vouchers/:id", partnerController.voucherDetail);
partnerRoutes.put("/vouchers/:id", validate(voucherWriteSchema), partnerController.updateVoucher);
partnerRoutes.put("/vouchers/:id/activate", partnerController.activateVoucher);
partnerRoutes.put("/vouchers/:id/disable", partnerController.disableVoucher);
partnerRoutes.delete("/vouchers/:id", partnerController.deleteVoucher);
partnerRoutes.get("/blogs", partnerController.blogs);
partnerRoutes.post("/blogs", validate(blogWriteSchema), partnerController.createBlog);
partnerRoutes.get("/blogs/:id", partnerController.blogDetail);
partnerRoutes.put("/blogs/:id", validate(blogWriteSchema), partnerController.updateBlog);
partnerRoutes.put("/blogs/:id/submit", partnerController.submitBlog);
partnerRoutes.delete("/blogs/:id", partnerController.deleteBlog);
partnerRoutes.get("/tournaments", partnerController.tournaments);
partnerRoutes.post("/tournaments", validate(tournamentWriteSchema), partnerController.createTournament);
partnerRoutes.get("/tournaments/:id", partnerController.tournamentDetail);
partnerRoutes.put("/tournaments/:id", validate(tournamentWriteSchema), partnerController.updateTournament);
partnerRoutes.put("/tournaments/:id/submit", partnerController.submitTournament);
partnerRoutes.delete("/tournaments/:id", partnerController.deleteTournament);
