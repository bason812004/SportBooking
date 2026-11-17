import { prisma } from "../../config/db.js";
import type { HolidayDay } from "../../shared/utils/courtPricing.js";

export const holidayRepository = {
  /** Every holiday (a few dozen rows, used for holiday prices); none when the table does not exist. */
  async all(): Promise<HolidayDay[]> {
    try {
      return await prisma.$queryRaw<HolidayDay[]>`select holiday_date as "holidayDate", recurring from system_holidays`;
    } catch (error) {
      if ((error as { code?: string; meta?: { code?: string } }).meta?.code === "42P01" || /system_holidays/.test(String(error))) return [];
      throw error;
    }
  }
};
