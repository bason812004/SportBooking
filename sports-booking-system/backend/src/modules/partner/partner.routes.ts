import { Router } from "express";
import multer from "multer";
import { UserRole } from "@prisma/client";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  courtRegistrationSchema,
  courtWriteSchema,
  courtStatusSchema,
  courtSurfaceStatusSchema,
  courtSurfaceUpdateSchema,
  courtSurfaceCreateSchema,
  courtSurfaceParamsSchema,
  courtBlockWriteSchema,
  courtBlockParamsSchema,
  courtBlockBulkWriteSchema,
  courtAvailabilityGridQuerySchema,
  bookingQuerySchema,
  calendarQuerySchema,
  imageSchema,
  imageOrderSchema,
  priceWriteSchema,
  profileUpdateSchema,
  serviceWriteSchema,
  voucherWriteSchema,
  recipientWriteSchema,
  recipientUpdateSchema,
  timeChargePolicySchema
} from "./partner.validation.js";
import { partnerController } from "./partner.controller.js";
// Partners write posts with the same rules as users (see blogService).
import { blogCommentsToggleSchema, blogWriteSchema } from "../blogs/blog.validation.js";
import { courtImageController } from "../court-images/courtImage.controller.js";
import { imageCourtParams, imageRequestParams } from "../court-images/courtImage.validation.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 } });
export const partnerRoutes = Router();

partnerRoutes.use(authMiddleware, requireRole(UserRole.PARTNER));
partnerRoutes.get("/dashboard", partnerController.dashboard);
partnerRoutes.get("/profile", partnerController.profile);
partnerRoutes.put("/profile", validate(profileUpdateSchema), partnerController.updateProfile);
partnerRoutes.get("/courts", partnerController.courts);
partnerRoutes.post("/courts", validate(courtWriteSchema), partnerController.createCourt);
partnerRoutes.post("/courts/register", validate(courtRegistrationSchema), partnerController.registerCourts);
partnerRoutes.get("/courts/:id", partnerController.courtDetail);
partnerRoutes.get("/courts/:id/time-charge-policy", partnerController.timeChargePolicy);
partnerRoutes.put("/courts/:id/time-charge-policy", validate(timeChargePolicySchema), partnerController.updateTimeChargePolicy);
partnerRoutes.get("/courts/:id/surfaces", partnerController.courtSurfaces);
partnerRoutes.post("/courts/:id/surfaces", validate(courtSurfaceCreateSchema), partnerController.createCourtSurface);
partnerRoutes.delete("/courts/:id/surfaces/:surfaceId", validate(courtSurfaceParamsSchema), partnerController.deleteCourtSurface);
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
partnerRoutes.get("/courts/:id/image-requests", validate(imageCourtParams), courtImageController.partnerList);
partnerRoutes.post("/image-requests/:id/cancel", validate(imageRequestParams), courtImageController.cancel);
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
