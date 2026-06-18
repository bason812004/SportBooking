import { z } from "zod";

const password = z.string().min(8, "Mat khau toi thieu 8 ky tu");

export const registerSchema = z.object({
  body: z.object({
    fullName: z.string().min(2),
    email: z.string().email(),
    phone: z.string().optional(),
    password
  })
});

export const registerPartnerSchema = z.object({
  body: z.object({
    fullName: z.string().min(2),
    email: z.string().email(),
    phone: z.string().optional(),
    password,
    businessName: z.string().min(2),
    address: z.string().min(5),
    verificationDocumentUrl: z.string().url().optional()
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1)
  })
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: password
  })
});

export const googleAuthSchema = z.object({
  body: z.object({
    credential: z.string().min(10)
  })
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(10)
  })
});
