import { Readable } from "node:stream";
import type { UploadApiResponse } from "cloudinary";
import { cloudinary, isCloudinaryConfigured } from "../../config/cloudinary.js";
import { env } from "../../config/env.js";
import { ValidationError } from "../errors/AppError.js";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 25 * 1024 * 1024; // 25MB

export type UploadedImage = {
  imageUrl: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
};

export type UploadedVideo = {
  videoUrl: string;
  publicId: string;
  duration?: number;
  format: string;
  bytes: number;
};

async function uploadStream(
  options: Record<string, unknown>,
  buffer: Buffer
): Promise<UploadApiResponse> {
  if (!isCloudinaryConfigured) {
    throw new ValidationError("Chua cau hinh Cloudinary");
  }
  return new Promise<UploadApiResponse>((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(options, (error, uploaded) => {
      if (error) return reject(error);
      if (!uploaded) return reject(new Error("Cloudinary did not return an upload result"));
      resolve(uploaded);
    });
    Readable.from(buffer).pipe(upload);
  });
}

export const cloudinaryService = {
  async uploadCourtImage(file: Express.Multer.File, courtId: string): Promise<UploadedImage> {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      throw new ValidationError("Chi chap nhan anh JPEG, PNG hoac WebP");
    }
    if (file.size > MAX_IMAGE_SIZE) {
      throw new ValidationError("Anh toi da 5MB");
    }
    let result: UploadApiResponse;
    try {
      result = await uploadStream(
        {
          folder: `${env.CLOUDINARY_FOLDER}/courts/${courtId}`,
          resource_type: "image",
          allowed_formats: ["jpg", "jpeg", "png", "webp"],
          unique_filename: true,
          overwrite: false
        },
        file.buffer
      );
    } catch (error) {
      console.error("Cloudinary upload failed", error);
      throw new ValidationError("Khong the tai anh len Cloudinary");
    }

    return {
      imageUrl: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes
    };
  },

  async uploadBlogCover(file: Express.Multer.File): Promise<UploadedImage> {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      throw new ValidationError("Chi chap nhan anh JPEG, PNG hoac WebP");
    }
    if (file.size > MAX_IMAGE_SIZE) {
      throw new ValidationError("Anh toi da 5MB");
    }
    let result: UploadApiResponse;
    try {
      result = await uploadStream(
        {
          folder: `${env.CLOUDINARY_FOLDER}/blogs`,
          resource_type: "image",
          allowed_formats: ["jpg", "jpeg", "png", "webp"],
          unique_filename: true,
          overwrite: false
        },
        file.buffer
      );
    } catch (error) {
      console.error("Cloudinary blog cover upload failed", error);
      throw new ValidationError("Khong the tai anh bia len Cloudinary");
    }

    return {
      imageUrl: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes
    };
  },

  async uploadAvatar(file: Express.Multer.File, userId: string): Promise<UploadedImage> {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      throw new ValidationError("Chi chap nhan anh JPEG, PNG hoac WebP");
    }
    if (file.size > MAX_IMAGE_SIZE) {
      throw new ValidationError("Anh toi da 5MB");
    }
    let result: UploadApiResponse;
    try {
      result = await uploadStream(
        {
          folder: `${env.CLOUDINARY_FOLDER}/avatars/${userId}`,
          resource_type: "image",
          allowed_formats: ["jpg", "jpeg", "png", "webp"],
          unique_filename: true,
          overwrite: true,
          transformation: [{ width: 512, height: 512, crop: "limit", quality: "auto:good" }]
        },
        file.buffer
      );
    } catch (error) {
      console.error("Cloudinary avatar upload failed", error);
      throw new ValidationError("Khong the tai avatar len Cloudinary");
    }
    return {
      imageUrl: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes
    };
  },

  async uploadChatImage(file: Express.Multer.File, postId: string): Promise<UploadedImage> {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      throw new ValidationError("Chi chap nhan anh JPEG, PNG hoac WebP");
    }
    if (file.size > MAX_IMAGE_SIZE) {
      throw new ValidationError("Anh toi da 5MB");
    }
    let result: UploadApiResponse;
    try {
      result = await uploadStream(
        {
          folder: `${env.CLOUDINARY_FOLDER}/team-chat/${postId}`,
          resource_type: "image",
          allowed_formats: ["jpg", "jpeg", "png", "webp"],
          unique_filename: true,
          overwrite: false
        },
        file.buffer
      );
    } catch (error) {
      console.error("Cloudinary chat image upload failed", error);
      throw new ValidationError("Khong the tai anh chat len Cloudinary");
    }
    return {
      imageUrl: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes
    };
  },

  async uploadChatVideo(file: Express.Multer.File, postId: string): Promise<UploadedVideo> {
    if (!ALLOWED_VIDEO_TYPES.has(file.mimetype)) {
      throw new ValidationError("Chi chap nhan video MP4, WebM hoac MOV");
    }
    if (file.size > MAX_VIDEO_SIZE) {
      throw new ValidationError("Video toi da 25MB");
    }
    let result: UploadApiResponse;
    try {
      result = await uploadStream(
        {
          folder: `${env.CLOUDINARY_FOLDER}/team-chat/${postId}`,
          resource_type: "video",
          allowed_formats: ["mp4", "webm", "mov"],
          unique_filename: true,
          overwrite: false,
          eager: [{ format: "jpg", transformation: [{ width: 320, height: 240, crop: "fill" }] }]
        },
        file.buffer
      );
    } catch (error) {
      console.error("Cloudinary chat video upload failed", error);
      throw new ValidationError("Khong the tai video chat len Cloudinary");
    }
    const thumbnailUrl = Array.isArray((result as unknown as { eager?: Array<{ secure_url?: string }> }).eager)
      ? (result as unknown as { eager?: Array<{ secure_url?: string }> }).eager?.[0]?.secure_url
      : undefined;
    return {
      videoUrl: result.secure_url,
      publicId: result.public_id,
      duration: result.duration,
      format: result.format,
      bytes: result.bytes
    } as UploadedVideo & { thumbnailUrl?: string } as UploadedVideo;
  },

  async deleteImage(publicId?: string | null) {
    if (!publicId || !isCloudinaryConfigured) return;
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
    } catch (error) {
      console.error("Cloudinary delete failed", error);
    }
  },

  async deleteVideo(publicId?: string | null) {
    if (!publicId || !isCloudinaryConfigured) return;
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: "video", invalidate: true });
    } catch (error) {
      console.error("Cloudinary video delete failed", error);
    }
  }
};
