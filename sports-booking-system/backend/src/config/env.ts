import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(24, "JWT_SECRET should be at least 24 characters"),
  JWT_ACCESS_SECRET: z.string().optional(),
  JWT_REFRESH_SECRET: z.string().optional(),
  JWT_EXPIRES_IN: z.string().default("7d"),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default("7d"),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default("7d"),
  BCRYPT_SALT_ROUNDS: z.coerce.number().default(10),
  GOOGLE_CLIENT_ID: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM_NAME: z.string().default("Sports Booking System"),
  MAIL_FROM_ADDRESS: z.string().email().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default("court-images"),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_FOLDER: z.string().default("sports-booking"),
  FRONTEND_URL: z.string().default("http://localhost:5173"),
  PAYMENT_PROVIDER: z.string().default("LOCAL_QR"),
  PAYMENT_API_KEY: z.string().optional(),
  PAYMENT_SECRET_KEY: z.string().optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  PAYMENT_RETURN_URL: z.string().optional(),
  PAYMENT_WEBHOOK_URL: z.string().optional(),
  PAYMENT_BANK_ID: z.string().default("mbbank"),
  PAYMENT_BANK_ACCOUNT: z.string().default("0986966745"),
  PAYMENT_BANK_OWNER: z.string().default("NGUYEN BA SON"),
  PAYMENT_QR_EXPIRES_MINUTES: z.coerce.number().int().positive().default(15),
  BOOKING_HOLD_EXPIRES_MINUTES: z.coerce.number().int().positive().default(15),
  PAYOUT_PROVIDER: z.string().default("fake"),
  PAYOUT_WEBHOOK_SECRET: z.string().optional(),
  PAYOUT_FAKE_SUCCESS_RATE: z.coerce.number().min(0).max(1).default(0.8),
  APP_BASE_URL: z.string().default("http://localhost:8080"),
  WITHDRAWAL_AUTO_APPROVE_LIMIT: z.coerce.number().min(0).default(5_000_000),
  ML_SERVICE_URL: z.string().optional(),
  ML_SERVICE_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),
  ML_MIN_HISTORY: z.coerce.number().int().positive().default(50)
});

export const env = envSchema.parse(process.env);
