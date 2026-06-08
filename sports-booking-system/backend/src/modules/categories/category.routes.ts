import { Router } from "express";
import { categoryController } from "./category.controller.js";

export const categoryRoutes = Router();

categoryRoutes.get("/", categoryController.list);
