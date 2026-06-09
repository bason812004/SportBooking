import { Router } from "express";
import { blogController } from "./blog.controller.js";

export const blogRoutes = Router();

blogRoutes.get("/", blogController.list);
blogRoutes.get("/:slug", blogController.detail);
