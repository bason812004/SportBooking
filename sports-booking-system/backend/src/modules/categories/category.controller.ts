import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { categoryService } from "./category.service.js";

export const categoryController = {
  list: asyncHandler(async (_req, res) => sendSuccess(res, await categoryService.list()))
};
