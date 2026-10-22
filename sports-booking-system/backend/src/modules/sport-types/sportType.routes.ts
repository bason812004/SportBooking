import { Router } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { categoryService } from "../categories/category.service.js";

export const sportTypeRoutes = Router();

sportTypeRoutes.get(
  "/",
  asyncHandler(async (_req, res) => {
    const categories = await categoryService.list();
    sendSuccess(
      res,
      categories.map((category) => ({
        value: category.id,
        code: category.slug,
        label: category.name,
        categoryId: category.id
      }))
    );
  })
);
