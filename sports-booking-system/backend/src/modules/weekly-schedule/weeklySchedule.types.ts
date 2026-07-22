export type WeeklySlotStatus =
  | "AVAILABLE"
  | "BOOKED"
  | "BLOCKED"
  | "MAINTENANCE"
  | "OUTSIDE_HOURS"
  | "HELD";

export type DynamicPricingAdjustment = {
  ruleName: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number;
  amount: number;
};

export type WeeklySlotRow = {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  status: WeeklySlotStatus;
  basePrice: number;
  finalPrice: number;
  dynamicAdjustmentAmount: number;
  adjustments: DynamicPricingAdjustment[];
  ruleNames: string[];
  predictionLevel: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH" | null;
  predictionStatus: "INSUFFICIENT_DATA" | "GENERATED" | "FAILED";
  predictedOccupancyRate: number | null;
  blockReason: string | null;
  bookingCode: string | null;
};

// Internal slot used while assembling the schedule. Mirrors WeeklySlotRow plus
// runtime fields that aren't part of the public response payload.
export type InternalWeeklySlot = WeeklySlotRow & {
  bookingId: string | null;
  bookingStatus: string | null;
  confidenceScore: number | null;
};

export type WeeklyDay = {
  date: string;
  weekday: number; // 1..7 (Mon..Sun)
  slots: WeeklySlotRow[];
};

export type WeeklyDynamicPriceEntry = {
  date: string;
  startTime: string;
  endTime: string;
  basePrice: number;
  finalPrice: number;
  dynamicAdjustmentAmount: number;
  adjustments: DynamicPricingAdjustment[];
  ruleNames: string[];
};

export type WeeklyBookingEntry = {
  id: string;
  bookingCode: string;
  date: string;
  startTime: string;
  endTime: string;
  bookingStatus: string;
  userFullName?: string | null;
};

export type WeeklyMaintenanceEntry = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string | null;
  isMaintenance: boolean;
};

export type WeeklyVoucherEntry = {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  maxDiscountAmount?: number | null;
  minBookingAmount: number;
  endDate: string;
  usedCount: number;
  usageLimit?: number | null;
  startDate: string;
  applicableDays: string | null;
  startTime: string | null;
  endTime: string | null;
  holidayOnly: boolean;
  holidayDates: string[] | null;
  applicableStartDate: string | null;
  applicableEndDate: string | null;
  partnerName: string | null;
};

export type WeeklyScheduleCourt = {
  id: string;
  name: string;
  address: string | null;
  district: string | null;
  city: string | null;
  openingTime: string; // HH:mm
  closingTime: string; // HH:mm
  minPrice: number;
  imageUrl: string | null;
  category: string | null;
};

export type WeeklyScheduleResponse = {
  court: WeeklyScheduleCourt;
  weekStart: string; // YYYY-MM-DD (Monday)
  weekEnd: string; // YYYY-MM-DD (Sunday)
  slotMinutes: number;
  openingTime: string;
  closingTime: string;
  days: WeeklyDay[];
  dynamicPricing: WeeklyDynamicPriceEntry[];
  bookings: WeeklyBookingEntry[];
  maintenance: WeeklyMaintenanceEntry[];
  availableVouchers: WeeklyVoucherEntry[];
};

export const WEEKLY_DEFAULT_OPEN = "05:00";
export const WEEKLY_DEFAULT_CLOSE = "23:00";
export const WEEKLY_SLOT_MINUTES = 60;
export const WEEKLY_RANGE_DAYS = 7;