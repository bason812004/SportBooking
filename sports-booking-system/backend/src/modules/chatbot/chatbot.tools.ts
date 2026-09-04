import { AppError, ForbiddenError } from "../../shared/errors/AppError.js";
import { bookingService } from "../bookings/booking.service.js";
import { courtService } from "../courts/court.service.js";
import { chatbotRepository } from "./chatbot.repository.js";
import type { PendingBookingSummary } from "./chatbot.types.js";

const PENDING_BOOKING_TTL_MS = 15 * 60 * 1000;

export type ToolContext = {
  userId?: string;
};

export type ToolDefinition = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  requiresAuth: boolean;
  execute: (input: any, ctx: ToolContext) => Promise<unknown>;
};

const searchCourtsTool: ToolDefinition = {
  name: "search_courts",
  description: "Tim danh sach san the thao theo mon the thao, khu vuc, gia. Tra ve danh sach san kem id, ten, gia thap nhat, danh gia.",
  requiresAuth: false,
  input_schema: {
    type: "object",
    properties: {
      keyword: { type: "string", description: "Tu khoa tim kiem (ten san, mon the thao)" },
      city: { type: "string", description: "Thanh pho/tinh" },
      district: { type: "string", description: "Quan/huyen" },
      sportType: { type: "string", description: "Loai mon the thao, vi du: cau long, bong da, tennis" }
    }
  },
  execute: async (input) => {
    const result = await courtService.list({
      keyword: input?.keyword,
      city: input?.city,
      district: input?.district,
      sportType: input?.sportType,
      limit: "10"
    });
    return {
      items: result.items.map((c: any) => ({
        courtId: c.id,
        name: c.name,
        city: c.city,
        district: c.district,
        minPrice: c.minPrice,
        averageRating: c.averageRating
      }))
    };
  }
};

const checkCourtAvailabilityTool: ToolDefinition = {
  name: "check_court_availability",
  description: "Kiem tra cac khung gio con trong cua mot san the thao trong mot ngay cu the.",
  requiresAuth: false,
  input_schema: {
    type: "object",
    properties: {
      courtId: { type: "string", description: "Id cua san (lay tu search_courts)" },
      date: { type: "string", description: "Ngay dinh dang YYYY-MM-DD" }
    },
    required: ["courtId", "date"]
  },
  execute: async (input) => {
    const result = await courtService.availability(input.courtId, input.date);
    return {
      date: result.date,
      openingTime: result.openingTime,
      closingTime: result.closingTime,
      availableSlots: result.slots.filter((s: any) => s.status === "AVAILABLE" || s.available === true)
    };
  }
};

const getCourtDetailTool: ToolDefinition = {
  name: "get_court_detail",
  description: "Lay thong tin chi tiet mot san the thao: gia, gio mo cua, danh gia, dia chi.",
  requiresAuth: false,
  input_schema: {
    type: "object",
    properties: {
      courtId: { type: "string", description: "Id cua san" }
    },
    required: ["courtId"]
  },
  execute: async (input) => {
    const court = await courtService.detail(input.courtId);
    return {
      courtId: court.id,
      name: court.name,
      address: court.address,
      city: court.city,
      district: court.district,
      openingTime: court.openingTime,
      closingTime: court.closingTime,
      minPrice: court.minPrice,
      averageRating: court.averageRating
    };
  }
};

const getMyBookingsTool: ToolDefinition = {
  name: "get_my_bookings",
  description: "Lay danh sach cac don dat san cua nguoi dung dang dang nhap.",
  requiresAuth: true,
  input_schema: {
    type: "object",
    properties: {
      page: { type: "string", description: "Trang, mac dinh 1" }
    }
  },
  execute: async (input, ctx) => {
    if (!ctx.userId) throw new ForbiddenError();
    const result = await bookingService.listForUser(ctx.userId, { page: input?.page, limit: "10" });
    return result;
  }
};

const getBookingDetailTool: ToolDefinition = {
  name: "get_booking_detail",
  description: "Lay chi tiet mot don dat san cua nguoi dung dang dang nhap, bao gom trang thai thanh toan.",
  requiresAuth: true,
  input_schema: {
    type: "object",
    properties: {
      bookingId: { type: "string", description: "Id don dat san" }
    },
    required: ["bookingId"]
  },
  execute: async (input, ctx) => {
    if (!ctx.userId) throw new ForbiddenError();
    return bookingService.getForUser(ctx.userId, input.bookingId);
  }
};

const proposeBookingTool: ToolDefinition = {
  name: "propose_booking",
  description:
    "Bao gia va tao mot de xuat dat san (khong dat that) cho MOT san cu the, co the gom nhieu khung gio trong cung 1 ngay (vi du: 18:00-19:00 va 20:00-21:00). Dung khi nguoi dung da chon duoc san, ngay va (cac) khung gio cu the. Neu nguoi dung muon dat nhieu san khac nhau, chi duoc goi cong cu nay cho MOT san moi luot, cho nguoi dung xac nhan xong roi moi de xuat san tiep theo. Ket qua tra ve pendingBookingId de nguoi dung xac nhan tren giao dien.",
  requiresAuth: true,
  input_schema: {
    type: "object",
    properties: {
      courtId: { type: "string" },
      bookingDate: { type: "string", description: "YYYY-MM-DD" },
      slots: {
        type: "array",
        description: "Danh sach cac khung gio can dat trong ngay bookingDate, cung 1 san",
        minItems: 1,
        items: {
          type: "object",
          properties: {
            startTime: { type: "string", description: "HH:00" },
            endTime: { type: "string", description: "HH:00" }
          },
          required: ["startTime", "endTime"]
        }
      },
      paymentType: { type: "string", enum: ["DEPOSIT", "FULL_PAYMENT", "PAY_AT_COURT"], description: "Hinh thuc thanh toan mong muon" },
      voucherCode: { type: "string" }
    },
    required: ["courtId", "bookingDate", "slots", "paymentType"]
  },
  execute: async (input, ctx): Promise<{ pendingBookingId: string; summary: PendingBookingSummary }> => {
    if (!ctx.userId) throw new ForbiddenError();

    const slots = input.slots as Array<{ startTime: string; endTime: string }>;

    const quoteInput = {
      courtId: input.courtId,
      days: [{ bookingDate: input.bookingDate, slots }],
      services: [],
      voucherCode: input.voucherCode
    };

    const quote = await bookingService.quote(ctx.userId, quoteInput as any);
    const court = await courtService.detail(input.courtId);

    const paymentType = (input.paymentType ?? "PAY_AT_COURT") as "DEPOSIT" | "FULL_PAYMENT" | "PAY_AT_COURT";
    const paymentAmount =
      paymentType === "FULL_PAYMENT" ? quote.totalAmount : paymentType === "DEPOSIT" ? quote.minimumDepositAmount : 0;

    const expiresAt = new Date(Date.now() + PENDING_BOOKING_TTL_MS);
    const checkoutPayload = { ...quoteInput, paymentType };

    const summary: PendingBookingSummary = {
      pendingBookingId: "",
      courtId: input.courtId,
      courtName: court.name,
      bookingDate: input.bookingDate,
      slots,
      totalAmount: quote.totalAmount,
      paymentType,
      paymentAmount,
      expiresAt: expiresAt.toISOString()
    };

    const pendingBooking = await chatbotRepository.createPendingBooking({
      userId: ctx.userId,
      quotePayload: checkoutPayload,
      quoteSummary: summary,
      expiresAt
    });

    summary.pendingBookingId = pendingBooking.id;
    return { pendingBookingId: pendingBooking.id, summary };
  }
};

export const ALL_TOOLS: ToolDefinition[] = [
  searchCourtsTool,
  checkCourtAvailabilityTool,
  getCourtDetailTool,
  getMyBookingsTool,
  getBookingDetailTool,
  proposeBookingTool
];

export function toolsForAuthState(isAuthenticated: boolean): ToolDefinition[] {
  return ALL_TOOLS.filter((tool) => isAuthenticated || !tool.requiresAuth);
}

export async function executeTool(tool: ToolDefinition, input: unknown, ctx: ToolContext) {
  try {
    const result = await tool.execute(input, ctx);
    return { isError: false, result };
  } catch (error) {
    if (error instanceof AppError) {
      return { isError: true, result: { message: error.message } };
    }
    throw error;
  }
}
