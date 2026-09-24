import { v2 as cloudinary } from "cloudinary";
import { env } from "./env.js";

const isConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME &&
    env.CLOUDINARY_API_KEY &&
    env.CLOUDINARY_API_SECRET
);

if (isConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
    // Uploads from a slow uplink legitimately take tens of seconds; fail them outright rather
    // than leaving the request hanging.
    timeout: 120_000
  });
}

export { cloudinary, isConfigured as isCloudinaryConfigured };
