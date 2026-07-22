import { Readable } from "node:stream";
import type { UploadApiResponse } from "cloudinary";
import { cloudinary, isCloudinaryConfigured } from "../../config/cloudinary.js";
import { env } from "../../config/env.js";
import { ValidationError } from "../errors/AppError.js";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

export type UploadedImage = {
  imageUrl: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
};

export const cloudinaryService = {
  async uploadCourtImage(file: Express.Multer.File, courtId: string): Promise<UploadedImage> {
    if (!isCloudinaryConfigured) {
      throw new ValidationError("Chua cau hinh Cloudinary");
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      throw new ValidationError("Chi chap nhan anh JPEG, PNG hoac WebP");
    }
    if (file.size > MAX_IMAGE_SIZE) {
      throw new ValidationError("Anh toi da 5MB");
    }

    let result: UploadApiResponse;
    try {
      result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const upload = cloudinary.uploader.upload_stream(
          {
            folder: `${env.CLOUDINARY_FOLDER}/courts/${courtId}`,
            resource_type: "image",
            allowed_formats: ["jpg", "jpeg", "png", "webp"],
            unique_filename: true,
            overwrite: false
          },
          (error, uploaded) => {
            if (error) return reject(error);
            if (!uploaded) return reject(new Error("Cloudinary did not return an upload result"));
            resolve(uploaded);
          }
        );

        Readable.from(file.buffer).pipe(upload);
      });
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
    if (!isCloudinaryConfigured) {
      throw new ValidationError("Chua cau hinh Cloudinary");
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      throw new ValidationError("Chi chap nhan anh JPEG, PNG hoac WebP");
    }
    if (file.size > MAX_IMAGE_SIZE) {
      throw new ValidationError("Anh toi da 5MB");
    }

    let result: UploadApiResponse;
    try {
      result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const upload = cloudinary.uploader.upload_stream(
          {
            folder: `${env.CLOUDINARY_FOLDER}/blogs`,
            resource_type: "image",
            allowed_formats: ["jpg", "jpeg", "png", "webp"],
            unique_filename: true,
            overwrite: false
          },
          (error, uploaded) => {
            if (error) return reject(error);
            if (!uploaded) return reject(new Error("Cloudinary did not return an upload result"));
            resolve(uploaded);
          }
        );

        Readable.from(file.buffer).pipe(upload);
      });
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

  async deleteImage(publicId?: string | null) {
    if (!publicId || !isCloudinaryConfigured) return;
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
    } catch (error) {
      console.error("Cloudinary delete failed", error);
      throw new ValidationError("Khong the xoa anh tren Cloudinary");
    }
  }
};
