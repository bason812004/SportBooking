import { NotFoundError } from "../../shared/errors/AppError.js";
import { toDbDate } from "../../shared/utils/time.js";
import { buildExcelReport, buildPdfReport, type ReportExportSheet, type ReportExportSection } from "../../shared/utils/reportExport.js";
import { getManagedCourtId } from "../recipient/recipient.service.js";
import { partnerIdForUser } from "../analytics/analytics.service.js";
import { reportRepository, type ReportScope } from "./report.repository.js";

type Range = { from: string; to: string };

function bucketFor(from: string, to: string) {
  const days = Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1;
  if (days <= 31) return "day" as const;
  if (days <= 120) return "week" as const;
  return "month" as const;
}

function bucketKey(date: Date, bucket: "day" | "week" | "month") {
  const iso = date.toISOString().slice(0, 10);
  if (bucket === "day") return iso;
  if (bucket === "month") return iso.slice(0, 7);
  const day = new Date(`${iso}T00:00:00.000Z`);
  const weekday = (day.getUTCDay() + 6) % 7; // Monday = 0
  day.setUTCDate(day.getUTCDate() - weekday);
  return day.toISOString().slice(0, 10);
}

async function revenue(scope: ReportScope, range: Range) {
  const bucket = bucketFor(range.from, range.to);
  const rows = await reportRepository.revenueRows(scope, toDbDate(range.from), toDbDate(range.to));
  const buckets = new Map<string, { period: string; grossAmount: number; commissionAmount: number; netAmount: number }>();
  for (const row of rows) {
    const key = bucketKey(row.bookingDate, bucket);
    const entry = buckets.get(key) ?? { period: key, grossAmount: 0, commissionAmount: 0, netAmount: 0 };
    entry.grossAmount += row.grossAmount;
    entry.commissionAmount += row.commissionAmount;
    entry.netAmount += row.netAmount;
    buckets.set(key, entry);
  }
  return { bucket, series: Array.from(buckets.values()).sort((a, b) => a.period.localeCompare(b.period)) };
}

async function bookings(scope: ReportScope, range: Range) {
  const rows = await reportRepository.bookingBreakdown(scope, toDbDate(range.from), toDbDate(range.to));
  return rows.map((row) => ({ status: row.bookingStatus, count: row._count }));
}

async function services(scope: ReportScope, range: Range) {
  return reportRepository.serviceSales(scope, toDbDate(range.from), toDbDate(range.to));
}

async function occupancy(scope: ReportScope, range: Range) {
  return reportRepository.occupancy(scope, toDbDate(range.from), toDbDate(range.to));
}

async function overview(scope: ReportScope, range: Range, includeCommission: boolean) {
  const [revenueResult, bookingRows, serviceRows, occupancyResult] = await Promise.all([
    revenue(scope, range),
    bookings(scope, range),
    services(scope, range),
    occupancy(scope, range)
  ]);

  const totals = revenueResult.series.reduce(
    (sum, item) => ({
      grossAmount: sum.grossAmount + item.grossAmount,
      commissionAmount: sum.commissionAmount + item.commissionAmount,
      netAmount: sum.netAmount + item.netAmount
    }),
    { grossAmount: 0, commissionAmount: 0, netAmount: 0 }
  );
  const totalBookings = bookingRows.reduce((sum, row) => sum + row.count, 0);
  const cancelledBookings = bookingRows.find((row) => row.status === "CANCELLED")?.count ?? 0;
  const totalServiceRevenue = serviceRows.reduce((sum, row) => sum + row.revenue, 0);

  return {
    totalRevenue: totals.grossAmount,
    ...(includeCommission ? { totalCommission: totals.commissionAmount, netRevenue: totals.netAmount } : {}),
    totalBookings,
    cancelledBookings,
    cancellationRate: totalBookings ? cancelledBookings / totalBookings : 0,
    totalServiceRevenue,
    occupancyRate: occupancyResult.occupancyRate
  };
}

function dbTime(value: Date) {
  return value.toISOString().slice(11, 16);
}

function currency(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}

async function exportReport(scope: ReportScope, range: Range, format: "excel" | "pdf", includeCommission: boolean) {
  const [overviewResult, revenueResult, bookingRows, serviceRows] = await Promise.all([
    overview(scope, range, includeCommission),
    revenue(scope, range),
    bookings(scope, range),
    services(scope, range)
  ]);

  const title = "Bao cao hoat dong";
  const subtitle = `Tu ${range.from} den ${range.to}`;

  if (format === "excel") {
    const sheets: ReportExportSheet[] = [
      {
        name: "Tong quan",
        columns: [
          { header: "Chi tieu", key: "label", width: 30 },
          { header: "Gia tri", key: "value", width: 20 }
        ],
        rows: [
          { label: "Tong doanh thu", value: overviewResult.totalRevenue },
          ...(includeCommission
            ? [
                { label: "Tong hoa hong", value: (overviewResult as any).totalCommission },
                { label: "Doanh thu rong", value: (overviewResult as any).netRevenue }
              ]
            : []),
          { label: "Tong so booking", value: overviewResult.totalBookings },
          { label: "Booking huy", value: overviewResult.cancelledBookings },
          { label: "Ty le lap day san", value: `${(overviewResult.occupancyRate * 100).toFixed(1)}%` },
          { label: "Doanh thu dich vu", value: overviewResult.totalServiceRevenue }
        ]
      },
      {
        name: "Doanh thu theo thoi gian",
        columns: [
          { header: "Ky", key: "period", width: 18 },
          { header: "Doanh thu gop", key: "grossAmount", width: 18 },
          ...(includeCommission
            ? [
                { header: "Hoa hong", key: "commissionAmount", width: 18 },
                { header: "Doanh thu rong", key: "netAmount", width: 18 }
              ]
            : [])
        ],
        rows: revenueResult.series
      },
      {
        name: "Booking theo trang thai",
        columns: [
          { header: "Trang thai", key: "status", width: 20 },
          { header: "So luong", key: "count", width: 15 }
        ],
        rows: bookingRows
      },
      {
        name: "Dich vu",
        columns: [
          { header: "Ten dich vu", key: "name", width: 30 },
          { header: "So luong", key: "quantity", width: 12 },
          { header: "Doanh thu", key: "revenue", width: 18 }
        ],
        rows: serviceRows
      }
    ];
    return buildExcelReport({ title, sheets });
  }

  const sections: ReportExportSection[] = [
    {
      heading: "Tong quan",
      kpis: [
        { label: "Tong doanh thu", value: currency(overviewResult.totalRevenue) },
        { label: "Tong booking", value: String(overviewResult.totalBookings) },
        { label: "Ty le lap day", value: `${(overviewResult.occupancyRate * 100).toFixed(1)}%` },
        { label: "Doanh thu dich vu", value: currency(overviewResult.totalServiceRevenue) }
      ]
    },
    {
      heading: "Doanh thu theo thoi gian",
      table: {
        columns: includeCommission
          ? [
              { header: "Ky", key: "period" },
              { header: "Doanh thu gop", key: "grossAmount" },
              { header: "Hoa hong", key: "commissionAmount" },
              { header: "Doanh thu rong", key: "netAmount" }
            ]
          : [
              { header: "Ky", key: "period" },
              { header: "Doanh thu gop", key: "grossAmount" }
            ],
        rows: revenueResult.series
      }
    },
    {
      heading: "Booking theo trang thai",
      table: { columns: [{ header: "Trang thai", key: "status" }, { header: "So luong", key: "count" }], rows: bookingRows }
    },
    {
      heading: "Dich vu",
      table: {
        columns: [{ header: "Ten dich vu", key: "name" }, { header: "So luong", key: "quantity" }, { header: "Doanh thu", key: "revenue" }],
        rows: serviceRows
      }
    }
  ];
  return buildPdfReport({ title, subtitle, sections });
}

async function customerReport(userId: string) {
  const customer = await reportRepository.customerSummary(userId);
  if (!customer) throw new NotFoundError("Khong tim thay khach hang");
  const bookingRows = await reportRepository.customerBookingHistory(userId);

  const summary = bookingRows.reduce(
    (acc, booking) => {
      acc.totalBookings += 1;
      if (booking.bookingStatus === "COMPLETED") acc.completedBookings += 1;
      if (booking.bookingStatus === "CANCELLED") acc.cancelledBookings += 1;
      if (booking.bookingStatus === "NO_SHOW") acc.noShowBookings += 1;
      if (booking.paymentStatus === "PAID" || booking.paymentStatus === "PARTIALLY_REFUNDED") acc.totalSpent += booking.totalPrice;
      acc.totalRefund += booking.refundAmount;
      return acc;
    },
    { totalBookings: 0, completedBookings: 0, cancelledBookings: 0, noShowBookings: 0, totalSpent: 0, totalRefund: 0 }
  );

  return { customer, summary, bookings: bookingRows };
}

async function exportCustomerReport(userId: string, format: "excel" | "pdf") {
  const data = await customerReport(userId);
  const title = `Bao cao khach hang - ${data.customer.fullName}`;
  const subtitle = `SDT: ${data.customer.phone ?? "-"} | Email: ${data.customer.email ?? "-"}`;

  const bookingRows = data.bookings.map((booking) => ({
    bookingCode: booking.bookingCode,
    date: booking.bookingDate.toISOString().slice(0, 10),
    court: booking.court.name,
    status: booking.bookingStatus,
    totalPrice: booking.totalPrice
  }));

  if (format === "excel") {
    const sheets: ReportExportSheet[] = [
      {
        name: "Tong quan",
        columns: [
          { header: "Chi tieu", key: "label", width: 30 },
          { header: "Gia tri", key: "value", width: 20 }
        ],
        rows: [
          { label: "Tong so booking", value: data.summary.totalBookings },
          { label: "Hoan thanh", value: data.summary.completedBookings },
          { label: "Da huy", value: data.summary.cancelledBookings },
          { label: "Khong den", value: data.summary.noShowBookings },
          { label: "Tong chi tieu", value: data.summary.totalSpent },
          { label: "Tong tien hoan", value: data.summary.totalRefund }
        ]
      },
      {
        name: "Lich su booking",
        columns: [
          { header: "Ma booking", key: "bookingCode", width: 18 },
          { header: "Ngay", key: "date", width: 14 },
          { header: "San", key: "court", width: 24 },
          { header: "Trang thai", key: "status", width: 16 },
          { header: "Thanh tien", key: "totalPrice", width: 16 }
        ],
        rows: bookingRows
      }
    ];
    return buildExcelReport({ title, sheets });
  }

  const sections: ReportExportSection[] = [
    {
      heading: "Tong quan khach hang",
      kpis: [
        { label: "Tong booking", value: String(data.summary.totalBookings) },
        { label: "Hoan thanh", value: String(data.summary.completedBookings) },
        { label: "Da huy", value: String(data.summary.cancelledBookings) },
        { label: "Tong chi tieu", value: currency(data.summary.totalSpent) }
      ]
    },
    {
      heading: "Lich su booking",
      table: {
        columns: [
          { header: "Ma booking", key: "bookingCode" },
          { header: "Ngay", key: "date" },
          { header: "San", key: "court" },
          { header: "Trang thai", key: "status" },
          { header: "Thanh tien", key: "totalPrice" }
        ],
        rows: bookingRows
      }
    }
  ];
  return buildPdfReport({ title, subtitle, sections });
}

async function exportBookingReport(bookingId: string, format: "excel" | "pdf") {
  const booking = await reportRepository.bookingDetailForReport(bookingId);
  if (!booking) throw new NotFoundError("Khong tim thay booking");

  const title = `Bao cao booking - ${booking.bookingCode}`;
  const subtitle = `Khach hang: ${booking.user.fullName} | SDT: ${booking.user.phone ?? "-"} | Email: ${booking.user.email ?? "-"}`;

  const infoRows = [
    { label: "Ma booking", value: booking.bookingCode },
    { label: "Ngay", value: booking.bookingDate.toISOString().slice(0, 10) },
    { label: "Gio choi", value: `${dbTime(booking.startTime)} - ${dbTime(booking.endTime)}` },
    { label: "San", value: booking.court.name },
    { label: "San con", value: booking.courtSurface?.name ?? "-" },
    { label: "Trang thai booking", value: booking.bookingStatus },
    { label: "Trang thai thanh toan", value: booking.paymentStatus },
    { label: "Voucher", value: booking.bookingVoucher ? `${booking.bookingVoucher.voucher.code} - ${booking.bookingVoucher.voucher.title}` : "-" },
    { label: "Tong tien", value: booking.totalPrice },
    { label: "Tien hoan", value: booking.refundAmount }
  ];

  const serviceRows = booking.bookingServices.map((service) => ({
    name: service.service?.name ?? "Dich vu khac",
    quantity: service.quantity,
    totalPrice: service.totalPrice
  }));

  if (format === "excel") {
    const sheets: ReportExportSheet[] = [
      {
        name: "Thong tin booking",
        columns: [
          { header: "Chi tieu", key: "label", width: 30 },
          { header: "Gia tri", key: "value", width: 30 }
        ],
        rows: infoRows
      },
      {
        name: "Dich vu",
        columns: [
          { header: "Ten dich vu", key: "name", width: 30 },
          { header: "So luong", key: "quantity", width: 12 },
          { header: "Thanh tien", key: "totalPrice", width: 18 }
        ],
        rows: serviceRows
      }
    ];
    return buildExcelReport({ title, sheets });
  }

  const sections: ReportExportSection[] = [
    {
      heading: "Thong tin booking",
      table: { columns: [{ header: "Chi tieu", key: "label" }, { header: "Gia tri", key: "value" }], rows: infoRows }
    },
    {
      heading: "Dich vu",
      table: {
        columns: [{ header: "Ten dich vu", key: "name" }, { header: "So luong", key: "quantity" }, { header: "Thanh tien", key: "totalPrice" }],
        rows: serviceRows.length ? serviceRows : [{ name: "Khong co dich vu", quantity: "", totalPrice: "" }]
      }
    }
  ];
  return buildPdfReport({ title, subtitle, sections });
}

export const adminReportService = {
  overview: (range: Range) => overview({}, range, true),
  revenue: (range: Range) => revenue({}, range),
  bookings: (range: Range) => bookings({}, range),
  services: (range: Range) => services({}, range),
  export: (range: Range, format: "excel" | "pdf") => exportReport({}, range, format, true),
  customer: (userId: string) => customerReport(userId),
  exportCustomer: (userId: string, format: "excel" | "pdf") => exportCustomerReport(userId, format),
  exportBooking: (bookingId: string, format: "excel" | "pdf") => exportBookingReport(bookingId, format)
};

export const partnerReportService = {
  async overview(userId: string, range: Range) {
    return overview({ partnerId: await partnerIdForUser(userId) }, range, true);
  },
  async revenue(userId: string, range: Range) {
    return revenue({ partnerId: await partnerIdForUser(userId) }, range);
  },
  async bookings(userId: string, range: Range) {
    return bookings({ partnerId: await partnerIdForUser(userId) }, range);
  },
  async services(userId: string, range: Range) {
    return services({ partnerId: await partnerIdForUser(userId) }, range);
  },
  async export(userId: string, range: Range, format: "excel" | "pdf") {
    return exportReport({ partnerId: await partnerIdForUser(userId) }, range, format, true);
  }
};

export const recipientReportService = {
  async overview(userId: string, range: Range) {
    return overview({ courtId: await getManagedCourtId(userId) }, range, false);
  },
  async revenue(userId: string, range: Range) {
    return revenue({ courtId: await getManagedCourtId(userId) }, range);
  },
  async bookings(userId: string, range: Range) {
    return bookings({ courtId: await getManagedCourtId(userId) }, range);
  },
  async services(userId: string, range: Range) {
    return services({ courtId: await getManagedCourtId(userId) }, range);
  },
  async export(userId: string, range: Range, format: "excel" | "pdf") {
    return exportReport({ courtId: await getManagedCourtId(userId) }, range, format, false);
  }
};
