import { NotFoundError } from "../../shared/errors/AppError.js";
import { toDbDate } from "../../shared/utils/time.js";
import { buildExcelReport, buildPdfReport, type ReportExportSheet, type ReportExportSection } from "../../shared/utils/reportExport.js";
import { getManagedCourtId } from "../recipient/recipient.service.js";
import { partnerIdForUser } from "../analytics/analytics.service.js";
import { reportRepository, type ReportScope } from "./report.repository.js";
import { bucketFor, bucketKey, rangePeriods } from "./report.calculations.js";

type Range = { from: string; to: string };

/** Booking statuses as the screens name them, for the exported files. */
const BOOKING_STATUS_LABELS: Record<string, string> = {
  PENDING: "Chờ xác nhận",
  PENDING_PAYMENT: "Chờ thanh toán",
  CONFIRMED: "Đã xác nhận",
  DEPOSIT_PAID: "Đã đặt cọc",
  IN_PROGRESS: "Đang chơi",
  CHECKOUT_PENDING: "Chờ checkout",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã hủy",
  NO_SHOW: "Không đến",
  REJECTED: "Bị từ chối",
  EXPIRED: "Hết hạn"
};

/**
 * Settled revenue per day, week or month of the range, every period listed (0 when nothing settled). A court's staff
 * get only the gross: commission and net stay with the partner and admins.
 */
async function revenue(scope: ReportScope, range: Range, includeCommission: boolean) {
  const bucket = bucketFor(range.from, range.to);
  const rows = await reportRepository.revenueRows(scope, toDbDate(range.from), toDbDate(range.to));
  const buckets = new Map(rangePeriods(range.from, range.to, bucket).map((period) => [period, { period, grossAmount: 0, commissionAmount: 0, netAmount: 0 }]));
  for (const row of rows) {
    const entry = buckets.get(bucketKey(row.bookingDate, bucket));
    if (!entry) continue;
    entry.grossAmount += row.grossAmount;
    entry.commissionAmount += row.commissionAmount;
    entry.netAmount += row.netAmount;
  }
  const series = Array.from(buckets.values());
  return {
    bucket,
    series: includeCommission ? series : series.map(({ period, grossAmount }) => ({ period, grossAmount }))
  };
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

/**
 * Every view reads the same settlement ledger: settled money is revenue, money of bookings not finished yet waits in
 * "Chờ quyết toán". Service money outside that ledger (sold at the counter) is its own figure, so the two add up
 * without overlap. Commission and net are for the partner and admins only.
 */
async function overview(scope: ReportScope, range: Range, includeCommission: boolean) {
  const from = toDbDate(range.from);
  const to = toDbDate(range.to);
  const [revenueRows, bookingRows, serviceRevenue, occupancyResult, pending] = await Promise.all([
    reportRepository.revenueRows(scope, from, to),
    bookings(scope, range),
    reportRepository.counterServiceRevenue(scope, from, to),
    occupancy(scope, range),
    reportRepository.pendingSettlements(scope, from, to)
  ]);

  const totals = revenueRows.reduce(
    (sum, item) => ({
      grossAmount: sum.grossAmount + item.grossAmount,
      commissionAmount: sum.commissionAmount + item.commissionAmount,
      netAmount: sum.netAmount + item.netAmount
    }),
    { grossAmount: 0, commissionAmount: 0, netAmount: 0 }
  );
  const totalBookings = bookingRows.reduce((sum, row) => sum + row.count, 0);
  const cancelledBookings = bookingRows.find((row) => row.status === "CANCELLED")?.count ?? 0;

  return {
    totalRevenue: totals.grossAmount,
    ...(includeCommission ? { totalCommission: totals.commissionAmount, netRevenue: totals.netAmount } : {}),
    pendingRevenue: pending.grossAmount,
    pendingCount: pending.count,
    totalBookings,
    cancelledBookings,
    cancellationRate: totalBookings ? cancelledBookings / totalBookings : 0,
    totalServiceRevenue: serviceRevenue,
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
    revenue(scope, range, includeCommission),
    bookings(scope, range),
    services(scope, range)
  ]);
  const statusRows = bookingRows.map((row) => ({ status: BOOKING_STATUS_LABELS[row.status] ?? row.status, count: row.count }));

  const title = "Báo cáo hoạt động";
  const subtitle = `Từ ${range.from} đến ${range.to} — doanh thu tính theo ngày chơi từ sổ quyết toán`;

  if (format === "excel") {
    const sheets: ReportExportSheet[] = [
      {
        name: "Tổng quan",
        columns: [
          { header: "Chỉ tiêu", key: "label", width: 36 },
          { header: "Giá trị", key: "value", width: 20 }
        ],
        rows: [
          { label: "Tổng doanh thu (đã quyết toán)", value: overviewResult.totalRevenue },
          ...(includeCommission
            ? [
                { label: "Tổng hoa hồng", value: overviewResult.totalCommission ?? 0 },
                { label: "Doanh thu ròng", value: overviewResult.netRevenue ?? 0 }
              ]
            : []),
          { label: "Chờ quyết toán (chưa tính vào doanh thu)", value: overviewResult.pendingRevenue },
          { label: "Dịch vụ bán tại sân (ngoài sổ quyết toán)", value: overviewResult.totalServiceRevenue },
          { label: "Tổng số booking", value: overviewResult.totalBookings },
          { label: "Booking hủy", value: overviewResult.cancelledBookings },
          { label: "Tỷ lệ lấp đầy sân", value: `${(overviewResult.occupancyRate * 100).toFixed(1)}%` }
        ]
      },
      {
        name: "Doanh thu theo thời gian",
        columns: [
          { header: "Kỳ", key: "period", width: 18 },
          { header: "Doanh thu gộp", key: "grossAmount", width: 18 },
          ...(includeCommission
            ? [
                { header: "Hoa hồng", key: "commissionAmount", width: 18 },
                { header: "Doanh thu ròng", key: "netAmount", width: 18 }
              ]
            : [])
        ],
        rows: revenueResult.series
      },
      {
        name: "Booking theo trạng thái",
        columns: [
          { header: "Trạng thái", key: "status", width: 20 },
          { header: "Số lượng", key: "count", width: 15 }
        ],
        rows: statusRows
      },
      {
        name: "Dịch vụ",
        columns: [
          { header: "Tên dịch vụ (đơn đã hoàn tất)", key: "name", width: 34 },
          { header: "Số lượng", key: "quantity", width: 12 },
          { header: "Doanh thu", key: "revenue", width: 18 }
        ],
        rows: serviceRows
      }
    ];
    return buildExcelReport({ title, sheets });
  }

  const sections: ReportExportSection[] = [
    {
      heading: "Tổng quan",
      kpis: [
        { label: "Tổng doanh thu", value: currency(overviewResult.totalRevenue) },
        { label: "Chờ quyết toán", value: currency(overviewResult.pendingRevenue) },
        { label: "Dịch vụ bán tại sân", value: currency(overviewResult.totalServiceRevenue) },
        { label: "Tổng booking", value: String(overviewResult.totalBookings) },
        { label: "Tỷ lệ lấp đầy", value: `${(overviewResult.occupancyRate * 100).toFixed(1)}%` }
      ]
    },
    {
      heading: "Doanh thu theo thời gian",
      table: {
        columns: includeCommission
          ? [
              { header: "Kỳ", key: "period" },
              { header: "Doanh thu gộp", key: "grossAmount" },
              { header: "Hoa hồng", key: "commissionAmount" },
              { header: "Doanh thu ròng", key: "netAmount" }
            ]
          : [
              { header: "Kỳ", key: "period" },
              { header: "Doanh thu gộp", key: "grossAmount" }
            ],
        rows: revenueResult.series
      }
    },
    {
      heading: "Booking theo trạng thái",
      table: { columns: [{ header: "Trạng thái", key: "status" }, { header: "Số lượng", key: "count" }], rows: statusRows }
    },
    {
      heading: "Dịch vụ bán ra (đơn đã hoàn tất)",
      table: {
        columns: [{ header: "Tên dịch vụ", key: "name" }, { header: "Số lượng", key: "quantity" }, { header: "Doanh thu", key: "revenue" }],
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
  revenue: (range: Range) => revenue({}, range, true),
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
    return revenue({ partnerId: await partnerIdForUser(userId) }, range, true);
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
    return revenue({ courtId: await getManagedCourtId(userId) }, range, false);
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
