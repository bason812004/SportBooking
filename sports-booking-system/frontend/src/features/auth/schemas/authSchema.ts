import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email khong hop le"),
  password: z.string().min(1, "Nhap mat khau")
});

export const registerSchema = loginSchema.extend({
  fullName: z.string().min(2, "Nhap ho ten"),
  phone: z.string().optional()
});

export const registerPartnerSchema = registerSchema.extend({
  businessName: z.string().min(2, "Nhap ten don vi"),
  address: z.string().min(5, "Nhap dia chi")
});
