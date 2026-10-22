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

// A slow uplink keeps the connection open long enough for something in between to drop it, so a
// reset here says nothing about the file being valid. Cloudinary's own rejections (bad key,
// unsupported format, size limit) are permanent and must not be retried.
const RETRYABLE_NETWORK_CODES = new Set(["ECONNRESET", "EPIPE", "ETIMEDOUT", "ECONNABORTED", "ENOTFOUND", "EAI_AGAIN"]);
const UPLOAD_RETRY_DELAYS_MS = [1_000, 3_000];

export function networkErrorCode(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === "string" && RETRYABLE_NETWORK_CODES.has(code)) return code;
  const message = (error as { message?: unknown } | null)?.message;
  if (typeof message === "string" && message.toLowerCase().includes("socket hang up")) return "ECONNRESET";
  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uploadOnce(options: Record<string, unknown>, buffer: Buffer): Promise<UploadApiResponse> {
  return new Promise<UploadApiResponse>((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(options, (error, uploaded) => {
      if (error) return reject(error);
      if (!uploaded) return reject(new Error("Cloudinary did not return an upload result"));
      resolve(uploaded);
    });
    Readable.from(buffer).pipe(upload);
  });
}

async function uploadStream(
  options: Record<string, unknown>,
  buffer: Buffer
): Promise<UploadApiResponse> {
  if (!isCloudinaryConfigured) {
    throw new ValidationError("Chua cau hinh Cloudinary");
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= UPLOAD_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await uploadOnce(options, buffer);
    } catch (error) {
      lastError = error;
      const code = networkErrorCode(error);
      if (!code || attempt === UPLOAD_RETRY_DELAYS_MS.length) break;
      console.warn(`Cloudinary upload failed with ${code}, retrying (${attempt + 1}/${UPLOAD_RETRY_DELAYS_MS.length})`);
      await sleep(UPLOAD_RETRY_DELAYS_MS[attempt]);
    }
  }
  throw lastError;
}

/** Appends the underlying cause so the API response is diagnosable without reading server logs. */
function withCause(message: string, error: unknown): string {
  const code = networkErrorCode(error) ?? (error as { http_code?: unknown } | null)?.http_code;
  const detail = (error as { message?: unknown } | null)?.message;
  if (code) return `${message} (${code})`;
  return typeof detail === "string" && detail ? `${message}: ${detail}` : message;
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
      throw new ValidationError(withCause("Khong the tai anh len Cloudinary", error));
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

  async uploadServiceImage(file: Express.Multer.File, partnerId: string): Promise<UploadedImage> {
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
          folder: `${env.CLOUDINARY_FOLDER}/services/${partnerId}`,
          resource_type: "image",
          allowed_formats: ["jpg", "jpeg", "png", "webp"],
          unique_filename: true,
          overwrite: false
        },
        file.buffer
      );
    } catch (error) {
      console.error("Cloudinary service image upload failed", error);
      throw new ValidationError(withCause("Khong the tai anh san pham len Cloudinary", error));
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
      throw new ValidationError(withCause("Khong the tai anh bia len Cloudinary", error));
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
      throw new ValidationError(withCause("Khong the tai avatar len Cloudinary", error));
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
      throw new ValidationError(withCause("Khong the tai anh chat len Cloudinary", error));
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
      throw new ValidationError(withCause("Khong the tai video chat len Cloudinary", error));
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
