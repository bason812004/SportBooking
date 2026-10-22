import type { RegistrationOtpEmail } from "./email.types.js";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[character]!);
}

export function registrationOtpTemplate(input: RegistrationOtpEmail) {
  const fullName = escapeHtml(input.fullName);
  const code = escapeHtml(input.code);
  return {
    subject: "Mã xác thực đăng ký tài khoản",
    text: [
      `Xin chào ${input.fullName},`,
      "",
      "Mã xác thực đăng ký tài khoản của bạn là:",
      "",
      input.code,
      "",
      `Mã này có hiệu lực trong ${input.expiresInMinutes} phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.`,
      "",
      "Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email."
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033">
        <p>Xin chào <strong>${fullName}</strong>,</p>
        <p>Mã xác thực đăng ký tài khoản của bạn là:</p>
        <p style="font-size:30px;font-weight:700;letter-spacing:8px;color:#2563eb">${code}</p>
        <p>Mã này có hiệu lực trong ${input.expiresInMinutes} phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
        <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.</p>
      </div>`
  };
}
