import "dotenv/config";
import nodemailer from "nodemailer";

const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "MAIL_FROM_ADDRESS", "PAYMENT_API_KEY", "PAYMENT_SECRET_KEY", "PAYMENT_WEBHOOK_SECRET", "PAYMENT_RETURN_URL", "PAYMENT_WEBHOOK_URL"];
let valid = true;
for (const key of required) {
  const value = process.env[key]?.trim();
  const configured = Boolean(value && !/YOUR_|example\.com|replace[-_]|your[-_]/i.test(value));
  console.log(`${key}: ${configured ? "OK" : "MISSING / PLACEHOLDER"}`);
  if (!configured) valid = false;
}
if (process.env.PAYMENT_PROVIDER !== "PAYOS") {
  console.log("PAYMENT_PROVIDER: must be PAYOS");
  valid = false;
}
try {
  const webhook = new URL(process.env.PAYMENT_WEBHOOK_URL ?? "");
  if (webhook.protocol !== "https:" || webhook.pathname !== "/api/payments/webhook/payos" || ["localhost", "127.0.0.1"].includes(webhook.hostname)) throw new Error();
} catch {
  console.log("PAYMENT_WEBHOOK_URL: requires a public HTTPS URL ending in /api/payments/webhook/payos");
  valid = false;
}

if (!valid) {
  process.exitCode = 1;
} else if (process.argv.includes("--smtp")) {
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  try {
    await transport.verify();
    console.log("SMTP: connection and authentication OK (no email sent)");
  } catch {
    console.error("SMTP: connection or authentication failed; check Gmail App Password and network access");
    process.exitCode = 1;
  } finally { transport.close(); }
} else {
  console.log("Configuration fields OK. Credentials and webhook registration have not been verified with payOS.");
}
