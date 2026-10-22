import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("errors.invalidEmail"),
  password: z.string().min(1, "errors.passwordRequired")
});

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, "errors.fullNameRequired"),
    email: z.string().trim().email("errors.invalidEmail"),
    phone: z
      .string()
      .trim()
      .optional()
      .refine((val) => !val || /^[0-9+\s-]{8,15}$/.test(val), "Số điện thoại không hợp lệ"),
    password: z.string().min(8, "errors.passwordMin8"),
    confirmPassword: z.string().min(8, "Vui lòng xác nhận mật khẩu")
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"]
  });

export const verifyRegistrationCodeSchema = z.object({
  email: z.string().trim().email("errors.invalidEmail"),
  code: z.string().regex(/^\d{6}$/, "errors.otpSixDigits")
});

export const registerPartnerSchema = z
  .object({
    fullName: z.string().trim().min(2, "errors.fullNameRequired"),
    email: z.string().trim().email("errors.invalidEmail"),
    phone: z
      .string()
      .trim()
      .optional()
      .refine((val) => !val || /^[0-9+\s-]{8,15}$/.test(val), "Số điện thoại không hợp lệ"),
    password: z.string().min(8, "errors.passwordMin8"),
    confirmPassword: z.string().min(8, "Vui lòng xác nhận mật khẩu"),
    businessName: z.string().trim().min(2, "errors.businessNameRequired"),
    address: z.string().trim().min(5, "errors.addressRequired")
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"]
  });
