import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { blogCommentController } from "./blogComment.controller.js";
import { blogController } from "./blog.controller.js";
import { blogCommentParamsSchema, blogCommentSchema, blogCommentsToggleSchema, blogSlugParamsSchema, blogWriteSchema, myBlogParamsSchema } from "./blog.validation.js";

export const blogRoutes = Router();

blogRoutes.get("/", blogController.list);
blogRoutes.get("/me", authMiddleware, blogController.listMine);
blogRoutes.post("/me", authMiddleware, validate(blogWriteSchema), blogController.createMine);
blogRoutes.get("/me/:id", authMiddleware, validate(myBlogParamsSchema), blogController.detailMine);
blogRoutes.put("/me/:id", authMiddleware, validate(myBlogParamsSchema.merge(blogWriteSchema)), blogController.updateMine);
blogRoutes.patch("/me/:id/comments", authMiddleware, validate(blogCommentsToggleSchema), blogController.updateMineComments);
blogRoutes.delete("/me/:id", authMiddleware, validate(myBlogParamsSchema), blogController.deleteMine);
blogRoutes.get("/:slug/comments", validate(blogSlugParamsSchema), blogCommentController.list);
blogRoutes.post("/:slug/comments", authMiddleware, validate(blogCommentSchema), blogCommentController.create);
blogRoutes.put("/:slug/comments/:commentId", authMiddleware, validate(blogCommentParamsSchema.merge(blogCommentSchema.pick({ body: true }))), blogCommentController.update);
blogRoutes.delete("/:slug/comments/:commentId", authMiddleware, validate(blogCommentParamsSchema), blogCommentController.delete);
blogRoutes.get("/:slug", blogController.detail);
