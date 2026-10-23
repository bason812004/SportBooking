import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { blogCommentController } from "./blogComment.controller.js";
import { blogController } from "./blog.controller.js";
import {
  blogCommentParamsSchema,
  blogCommentSchema,
  blogCommentsToggleSchema,
  blogListQuerySchema,
  blogSlugParamsSchema,
  blogWriteSchema,
  myBlogParamsSchema
} from "./blog.validation.js";

export const blogRoutes = Router();

// Only users and partners write blog posts; staff (recipients) and admins moderate or read them.
const author = [authMiddleware, requireRole("USER", "PARTNER")];

blogRoutes.get("/", validate(blogListQuerySchema), blogController.list);
blogRoutes.get("/me", ...author, blogController.listMine);
blogRoutes.post("/me", ...author, validate(blogWriteSchema), blogController.createMine);
blogRoutes.get("/me/:id", ...author, validate(myBlogParamsSchema), blogController.detailMine);
blogRoutes.put("/me/:id", ...author, validate(myBlogParamsSchema.merge(blogWriteSchema)), blogController.updateMine);
blogRoutes.put("/me/:id/submit", ...author, validate(myBlogParamsSchema), blogController.submitMine);
blogRoutes.patch("/me/:id/comments", ...author, validate(blogCommentsToggleSchema), blogController.updateMineComments);
blogRoutes.delete("/me/:id", ...author, validate(myBlogParamsSchema), blogController.deleteMine);
blogRoutes.get("/:slug/comments", validate(blogSlugParamsSchema), blogCommentController.list);
blogRoutes.post("/:slug/comments", authMiddleware, validate(blogCommentSchema), blogCommentController.create);
blogRoutes.put("/:slug/comments/:commentId", authMiddleware, validate(blogCommentParamsSchema.merge(blogCommentSchema.pick({ body: true }))), blogCommentController.update);
blogRoutes.delete("/:slug/comments/:commentId", authMiddleware, validate(blogCommentParamsSchema), blogCommentController.delete);
blogRoutes.get("/:slug", blogController.detail);
