import { Router } from "express";
import multer from "multer";
import { UserRole } from "@prisma/client";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { cloudinaryService } from "../../shared/services/cloudinary.service.js";
import { ValidationError } from "../../shared/errors/AppError.js";
import { userRepository } from "../users/user.repository.js";
import { teamPostRepository } from "../team-posts/teamPost.repository.js";
import { realtimeService } from "../realtime/realtime.service.js";
import { realtimeEvents } from "../realtime/realtime.events.js";

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export const uploadRoutes = Router();

// Profile avatar upload - any authenticated user.
uploadRoutes.post(
  "/avatar",
  authMiddleware,
  imageUpload.single("image"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ValidationError("Vui long chon mot file anh");
    if (!ALLOWED_IMAGE_TYPES.has(req.file.mimetype)) {
      throw new ValidationError("Chi chap nhan anh JPEG, PNG hoac WebP");
    }

    const result = await cloudinaryService.uploadAvatar(req.file, req.user!.id);
    await userRepository.updateAvatar(req.user!.id, result.imageUrl);
    const refreshed = await userRepository.findByIdForAvatar(req.user!.id);

    realtimeService.toUser(req.user!.id, realtimeEvents.userAvatarUpdated, { url: result.imageUrl });

    sendSuccess(res, {
      url: result.imageUrl,
      publicId: result.publicId,
      user: refreshed
    }, 201);
  })
);

// Blog cover image - existing route kept.
uploadRoutes.post(
  "/blogs/cover",
  authMiddleware,
  imageUpload.single("image"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ValidationError("Vui long chon mot file anh");
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

// Chat image - members of the team post.
uploadRoutes.post(
  "/team-chat/:postId/image",
  authMiddleware,
  imageUpload.single("image"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ValidationError("Vui long chon mot file anh");
    if (!ALLOWED_IMAGE_TYPES.has(req.file.mimetype)) {
      throw new ValidationError("Chi chap nhan anh JPEG, PNG hoac WebP");
    }

    const isMember = await teamPostRepository.isMember(req.params.postId, req.user!.id);
    if (!isMember) throw new ValidationError("Ban can tham gia nhom de gui anh");

    const result = await cloudinaryService.uploadChatImage(req.file, req.params.postId);
    sendSuccess(res, {
      url: result.imageUrl,
      publicId: result.publicId,
      width: result.width,
      height: result.height,
      format: result.format,
      fileName: req.file.originalname,
      size: result.bytes
    }, 201);
  })
);

// Chat video - members of the team post.
uploadRoutes.post(
  "/team-chat/:postId/video",
  authMiddleware,
  videoUpload.single("video"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ValidationError("Vui long chon mot file video");
    if (!ALLOWED_VIDEO_TYPES.has(req.file.mimetype)) {
      throw new ValidationError("Chi chap nhan video MP4, WebM hoac MOV");
    }

    const isMember = await teamPostRepository.isMember(req.params.postId, req.user!.id);
    if (!isMember) throw new ValidationError("Ban can tham gia nhom de gui video");

    const result = await cloudinaryService.uploadChatVideo(req.file, req.params.postId);
    sendSuccess(res, {
      url: result.videoUrl,
      publicId: result.publicId,
      duration: result.duration,
      format: result.format,
      fileName: req.file.originalname,
      size: result.bytes
    }, 201);
  })
);
