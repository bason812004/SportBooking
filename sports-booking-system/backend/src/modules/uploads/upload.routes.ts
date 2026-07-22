import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { cloudinaryService } from "../../shared/services/cloudinary.service.js";
import { ValidationError } from "../../shared/errors/AppError.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const uploadRoutes = Router();

// Upload blog cover image - Any authenticated user (USER or PARTNER)
uploadRoutes.post(
  "/blogs/cover",
  authMiddleware,
  upload.single("image"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ValidationError("Vui long chon mot file anh");
    }

    if (!ALLOWED_IMAGE_TYPES.has(req.file.mimetype)) {
      throw new ValidationError("Chi chap nhan anh JPEG, PNG hoac WebP");
    }

    const result = await cloudinaryService.uploadBlogCover(req.file);

    sendSuccess(res, {
      url: result.imageUrl,
      publicId: result.publicId,
      fileName: req.file.originalname,
      width: result.width,
      height: result.height,
      format: result.format
    }, 201);
  })
);
