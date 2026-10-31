import type { BankAccountChangedEmail, PasswordChangedEmail, RegistrationOtpEmail } from "./email.types.js";

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

export function bankAccountChangedTemplate(input: BankAccountChangedEmail) {
  const when = input.changedAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  const account = input.bankName || input.maskedAccount ? `${input.bankName ?? ""} ${input.maskedAccount ?? ""}`.trim() : "(đã xoá)";
  return {
    subject: "Tài khoản ngân hàng nhận tiền đã được thay đổi",
    text: [
      `Xin chào ${input.fullName},`,
      "",
      `Tài khoản ngân hàng nhận tiền rút của ${input.businessName} vừa được đổi lúc ${when}.`,
      `Tài khoản mới: ${account}.`,
      "",
      "Nếu không phải bạn thực hiện, hãy đổi mật khẩu ngay và liên hệ quản trị viên trước khi có yêu cầu rút tiền nào được xử lý."
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033">
        <p>Xin chào <strong>${escapeHtml(input.fullName)}</strong>,</p>
        <p>Tài khoản ngân hàng nhận tiền rút của <strong>${escapeHtml(input.businessName)}</strong> vừa được đổi lúc ${escapeHtml(when)}.</p>
        <p>Tài khoản mới: <strong>${escapeHtml(account)}</strong>.</p>
        <p style="color:#b91c1c">Nếu không phải bạn thực hiện, hãy đổi mật khẩu ngay và liên hệ quản trị viên trước khi có yêu cầu rút tiền nào được xử lý.</p>
      </div>`
  };
}

export function passwordChangedTemplate(input: PasswordChangedEmail) {
  const when = input.changedAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  return {
    subject: "Mật khẩu tài khoản đã được thay đổi",
    text: [
      `Xin chào ${input.fullName},`,
      "",
      `Mật khẩu tài khoản của bạn vừa được đổi lúc ${when}. Các thiết bị khác đã bị đăng xuất.`,
      "",
      "Nếu không phải bạn thực hiện, hãy dùng chức năng Quên mật khẩu để đặt lại ngay và liên hệ quản trị viên."
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033">
        <p>Xin chào <strong>${escapeHtml(input.fullName)}</strong>,</p>
        <p>Mật khẩu tài khoản của bạn vừa được đổi lúc ${escapeHtml(when)}. Các thiết bị khác đã bị đăng xuất.</p>
        <p style="color:#b91c1c">Nếu không phải bạn thực hiện, hãy dùng chức năng Quên mật khẩu để đặt lại ngay và liên hệ quản trị viên.</p>
      </div>`
  };
}
