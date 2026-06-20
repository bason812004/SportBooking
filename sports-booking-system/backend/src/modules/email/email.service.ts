import nodemailer from "nodemailer";
import { env } from "../../config/env.js";
import { ValidationError } from "../../shared/errors/AppError.js";
import { registrationOtpTemplate } from "./email.templates.js";
import type { RegistrationOtpEmail } from "./email.types.js";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !env.MAIL_FROM_ADDRESS) {
    throw new ValidationError("Dịch vụ email chưa được cấu hình. Vui lòng cấu hình SMTP.");
  }
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }
  });
  return transporter;
}

export const emailService = {
  async sendRegistrationOtp(input: RegistrationOtpEmail) {
    const template = registrationOtpTemplate(input);
    await getTransporter().sendMail({
      from: { name: env.MAIL_FROM_NAME, address: env.MAIL_FROM_ADDRESS! },
      to: input.to,
      ...template
    });
  }
};
