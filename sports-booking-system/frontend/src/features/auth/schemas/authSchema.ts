import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("errors.invalidEmail"),
  password: z.string().min(1, "errors.passwordRequired")
});

export const registerSchema = z.object({
  email: z.string().email("errors.invalidEmail"),
  password: z.string().min(8, "errors.passwordMin8"),
  fullName: z.string().min(2, "errors.fullNameRequired"),
  phone: z.string().optional()
});

export const verifyRegistrationCodeSchema = z.object({
  email: z.string().email("errors.invalidEmail"),
  code: z.string().regex(/^\d{6}$/, "errors.otpSixDigits")
});

export const registerPartnerSchema = registerSchema.extend({
  businessName: z.string().min(2, "errors.businessNameRequired"),
  address: z.string().min(5, "errors.addressRequired")
});
