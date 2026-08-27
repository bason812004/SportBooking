import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { adminReportService, partnerReportService, recipientReportService } from "./report.service.js";

function range(query: any) {
  return { from: query.from as string, to: query.to as string };
}

function sendFile(res: import("express").Response, buffer: Buffer, format: "excel" | "pdf", filenameBase: string) {
  if (format === "excel") {
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filenameBase}.xlsx"`);
  } else {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filenameBase}.pdf"`);
  }
  res.send(buffer);
}

export const adminReportController = {
  overview: asyncHandler(async (req, res) => sendSuccess(res, await adminReportService.overview(range(req.query)))),
  revenue: asyncHandler(async (req, res) => sendSuccess(res, await adminReportService.revenue(range(req.query)))),
  bookings: asyncHandler(async (req, res) => sendSuccess(res, await adminReportService.bookings(range(req.query)))),
  services: asyncHandler(async (req, res) => sendSuccess(res, await adminReportService.services(range(req.query)))),
  export: asyncHandler(async (req, res) => {
    const format = req.query.format as "excel" | "pdf";
    const buffer = await adminReportService.export(range(req.query), format);
    sendFile(res, buffer, format, "bao-cao-admin");
  }),
  customer: asyncHandler(async (req, res) => sendSuccess(res, await adminReportService.customer(req.params.userId))),
  exportCustomer: asyncHandler(async (req, res) => {
    const format = req.query.format as "excel" | "pdf";
    const buffer = await adminReportService.exportCustomer(req.params.userId, format);
    sendFile(res, buffer, format, `bao-cao-khach-hang-${req.params.userId}`);
  }),
  exportBooking: asyncHandler(async (req, res) => {
    const format = req.query.format as "excel" | "pdf";
    const buffer = await adminReportService.exportBooking(req.params.bookingId, format);
    sendFile(res, buffer, format, `bao-cao-booking-${req.params.bookingId}`);
  })
};

export const partnerReportController = {
  overview: asyncHandler(async (req, res) => sendSuccess(res, await partnerReportService.overview(req.user!.id, range(req.query)))),
  revenue: asyncHandler(async (req, res) => sendSuccess(res, await partnerReportService.revenue(req.user!.id, range(req.query)))),
  bookings: asyncHandler(async (req, res) => sendSuccess(res, await partnerReportService.bookings(req.user!.id, range(req.query)))),
  services: asyncHandler(async (req, res) => sendSuccess(res, await partnerReportService.services(req.user!.id, range(req.query)))),
  export: asyncHandler(async (req, res) => {
    const format = req.query.format as "excel" | "pdf";
    const buffer = await partnerReportService.export(req.user!.id, range(req.query), format);
    sendFile(res, buffer, format, "bao-cao-partner");
  })
};

export const recipientReportController = {
  overview: asyncHandler(async (req, res) => sendSuccess(res, await recipientReportService.overview(req.user!.id, range(req.query)))),
  revenue: asyncHandler(async (req, res) => sendSuccess(res, await recipientReportService.revenue(req.user!.id, range(req.query)))),
  bookings: asyncHandler(async (req, res) => sendSuccess(res, await recipientReportService.bookings(req.user!.id, range(req.query)))),
  services: asyncHandler(async (req, res) => sendSuccess(res, await recipientReportService.services(req.user!.id, range(req.query)))),
  export: asyncHandler(async (req, res) => {
    const format = req.query.format as "excel" | "pdf";
    const buffer = await recipientReportService.export(req.user!.id, range(req.query), format);
    sendFile(res, buffer, format, "bao-cao-recipient");
  })
};
