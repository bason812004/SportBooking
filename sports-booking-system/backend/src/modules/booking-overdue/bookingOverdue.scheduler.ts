import { env } from "../../config/env.js";
import { bookingOverdueService } from "./bookingOverdue.service.js";

let running = false;

async function runOnce() {
  // A slow run (many bookings) must not overlap the next tick and finish the same booking twice.
  if (running) return;
  running = true;
  try {
    const result = await bookingOverdueService.runOnce();
    if (result.finished || result.reminded) {
      console.log(`[BookingOverdue] Finished ${result.finished} and reminded ${result.reminded} overdue booking(s).`);
    }
  } catch (error) {
    console.error("[BookingOverdue] Overdue booking job error:", error);
  } finally {
    running = false;
  }
}

export function startBookingOverdueScheduler() {
  if (!env.BOOKING_OVERDUE_REMIND_HOURS && !env.BOOKING_AUTO_FINISH_HOURS) return;
  console.log(`[BookingOverdue] Checking overdue bookings every ${env.BOOKING_OVERDUE_INTERVAL_MS}ms.`);
  setTimeout(runOnce, 30_000);
  setInterval(runOnce, env.BOOKING_OVERDUE_INTERVAL_MS);
}
