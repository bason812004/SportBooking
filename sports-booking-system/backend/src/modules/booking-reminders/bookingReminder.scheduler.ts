import { env } from "../../config/env.js";
import { bookingReminderService } from "./bookingReminder.service.js";

async function runOnce() {
  try {
    const result = await bookingReminderService.runDetectionAndNotify();
    if (result.sent > 0) {
      console.log(`[BookingReminder] Sent ${result.sent} reminder(s) out of ${result.candidates} candidate pattern(s).`);
    }
  } catch (error) {
    console.error("[BookingReminder] Reminder job error:", error);
  }
}

export function startBookingReminderScheduler() {
  if (!env.BOOKING_REMINDER_ENABLED) return;
  console.log(`[BookingReminder] Starting background booking-pattern reminder job (every ${env.BOOKING_REMINDER_INTERVAL_MS}ms)...`);
  setInterval(runOnce, env.BOOKING_REMINDER_INTERVAL_MS);
}
