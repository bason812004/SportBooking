import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(1, "Nhập mật khẩu")
});

export const registerSchema = loginSchema.extend({
  fullName: z.string().min(2, "Nhập họ tên"),
  phone: z.string().optional()
});

export const registerPartnerSchema = registerSchema.extend({
  businessName: z.string().min(2, "Nhập tên đơn vị"),
  address: z.string().min(5, "Nhập địa chỉ")
});
