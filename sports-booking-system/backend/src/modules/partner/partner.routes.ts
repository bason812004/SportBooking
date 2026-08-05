import { Router } from "express";
import multer from "multer";
import { UserRole } from "@prisma/client";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  courtWriteSchema,
  courtStatusSchema,
  courtSurfaceStatusSchema,
  courtSurfaceUpdateSchema,
  courtBlockWriteSchema,
  courtBlockParamsSchema,
  courtBlockBulkWriteSchema,
  courtAvailabilityGridQuerySchema,
  bookingQuerySchema,
  blogCommentsToggleSchema,
  blogWriteSchema,
  calendarQuerySchema,
  imageSchema,
  imageOrderSchema,
  priceWriteSchema,
  profileUpdateSchema,
  serviceWriteSchema,
  voucherWriteSchema,
  recipientWriteSchema,
  recipientUpdateSchema
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
partnerRoutes.get("/courts/:id/surfaces", partnerController.courtSurfaces);
partnerRoutes.put("/courts/:id/surfaces/:surfaceId/status", validate(courtSurfaceStatusSchema), partnerController.updateCourtSurfaceStatus);
partnerRoutes.put("/courts/:id/surfaces/:surfaceId", validate(courtSurfaceUpdateSchema), partnerController.updateCourtSurface);
partnerRoutes.put("/courts/:id", validate(courtWriteSchema.partial()), partnerController.updateCourt);
partnerRoutes.delete("/courts/:id", partnerController.deactivateCourt);
partnerRoutes.put("/courts/:id/status", validate(courtStatusSchema), partnerController.updateCourtStatus);
partnerRoutes.get("/courts/:id/availability-grid", validate(courtAvailabilityGridQuerySchema), partnerController.courtAvailabilityGrid);
partnerRoutes.get("/courts/:id/blocks", partnerController.courtBlocks);
partnerRoutes.post("/courts/:id/blocks", validate(courtBlockWriteSchema), partnerController.createCourtBlock);
partnerRoutes.post("/courts/:id/blocks/bulk", validate(courtBlockBulkWriteSchema), partnerController.createCourtBlockBulk);
partnerRoutes.delete("/courts/:id/blocks/:blockId", validate(courtBlockParamsSchema), partnerController.cancelCourtBlock);
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
partnerRoutes.put("/bookings/:id/confirm", partnerController.confirm);
partnerRoutes.put("/bookings/:id/reject", partnerController.reject);
partnerRoutes.put("/bookings/:id/complete", partnerController.complete);
partnerRoutes.put("/bookings/:id/no-show", partnerController.noShow);
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
partnerRoutes.patch("/blogs/:id/comments", validate(blogCommentsToggleSchema), partnerController.updateBlogComments);
partnerRoutes.put("/blogs/:id/submit", partnerController.submitBlog);
partnerRoutes.delete("/blogs/:id", partnerController.deleteBlog);

partnerRoutes.get("/recipients", partnerController.listRecipients);
partnerRoutes.post("/recipients", validate(recipientWriteSchema), partnerController.createRecipient);
partnerRoutes.put("/recipients/:id", validate(recipientUpdateSchema), partnerController.updateRecipient);
partnerRoutes.delete("/recipients/:id", partnerController.deleteRecipient);
