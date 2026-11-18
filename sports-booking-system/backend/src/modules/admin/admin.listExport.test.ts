import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import { createDynamicFakePrisma } from "../../shared/testing/fakePrisma.js";

const fake = createDynamicFakePrisma();
mock.module("../../config/db.js", { namedExports: { prisma: fake.client } });
let total: number;
let filtersSeen: any[];
let audits: any[];
let files: any[];
const customer = {
  id: "u1", fullName: "Nguyễn Văn A", email: "a@x.vn", phone: "0901234567", status: "ACTIVE", emailVerified: true,
  createdAt: new Date("2026-10-01T03:00:00Z"), bookings: 3, totalSpent: 450000, totalRefund: 50000, lastBookingDate: new Date("2026-10-20T00:00:00Z")
};
const partner = {
  businessName: "Sân Bóng Xanh", address: "12 Lê Lợi", taxCode: "0312345678", approvalStatus: "APPROVED", bankName: "VCB",
  bankAccountNumber: "0123456789", bankAccountHolder: "NGUYEN VAN A", createdAt: new Date("2026-09-01T03:00:00Z"),
  user: { fullName: "Nguyễn Văn A", email: "p@x.vn", phone: null, status: "LOCKED" }, _count: { courts: 2 }
};
mock.module("./admin.repository.js", { namedExports: { adminRepository: {
  countCustomersForExport: async (filters: any) => { filtersSeen.push(filters); return total; },
  customersForExport: async (filters: any, limit: number) => { filtersSeen.push({ ...filters, limit }); return [customer]; },
  countPartnersForExport: async (filters: any) => { filtersSeen.push(filters); return total; },
  partnersForExport: async (filters: any, limit: number) => { filtersSeen.push({ ...filters, limit }); return [partner]; }
} } });
mock.module("../../shared/utils/reportExport.js", { namedExports: {
  buildExcelReport: async (input: any) => { files.push({ format: "excel", ...input }); return Buffer.from("xlsx"); },
  buildPdfReport: async (input: any) => { files.push({ format: "pdf", ...input }); return Buffer.from("pdf"); }
} });
mock.module("./admin.audit.js", { namedExports: {
  recordAdminAction: async (...args: any[]) => { audits.push(args); return {}; },
  verifyAuditChain: async () => ({})
} });
mock.module("../notifications/notification.service.js", { namedExports: { notificationService: { create: async () => ({}) } } });
mock.module("../realtime/realtime.service.js", { namedExports: { realtimeService: { toPublic: () => {}, toAdmin: () => {}, toPartner: () => {}, toUser: () => {} } } });
const { adminService, MAX_EXPORT_ROWS } = await import("./admin.service.js");

beforeEach(() => {
  total = 1;
  filtersSeen = [];
  audits = [];
  files = [];
});

describe("exporting the customer list", () => {
  it("passes the page's search and status, keeps numbers in Excel and records the export", async () => {
    await adminService.exportCustomers("admin1", { search: "nguyen", status: "ACTIVE", format: "excel" });
    assert.deepEqual(filtersSeen, [{ search: "nguyen", status: "ACTIVE" }, { search: "nguyen", status: "ACTIVE", limit: MAX_EXPORT_ROWS }]);
    const [file] = files;
    assert.equal(file.format, "excel");
    assert.deepEqual(file.sheets[0].rows[0], {
      fullName: "Nguyễn Văn A", email: "a@x.vn", phone: "0901234567", status: "Hoạt động", emailVerified: "Đã xác minh",
      createdAt: file.sheets[0].rows[0].createdAt, bookings: 3, totalSpent: 450000, totalRefund: 50000, lastBookingDate: "20/10/2026"
    });
    assert.deepEqual(audits.map((args) => [args[1], args[4]]), [["CUSTOMERS_EXPORTED", { filters: "tìm “nguyen” · Hoạt động", rows: 1, format: "excel" }]]);
  });

  it("writes money out in the landscape PDF", async () => {
    await adminService.exportCustomers("admin1", { format: "pdf" });
    const [file] = files;
    assert.equal(file.orientation, "landscape");
    assert.equal(file.sections[0].table.rows[0].totalSpent, "450.000 đ");
    assert.match(file.subtitle, /^1 khách hàng · không lọc · xuất lúc /);
  });

  it("refuses a list longer than the limit before reading it, and records nothing", async () => {
    total = MAX_EXPORT_ROWS + 1;
    await assert.rejects(adminService.exportCustomers("admin1", { format: "excel" }), (error: any) => {
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /Hãy lọc bớt/);
      return true;
    });
    assert.equal(filtersSeen.length, 1);
    assert.deepEqual([files, audits], [[], []]);
  });
});

describe("exporting the partner list", () => {
  it("masks the bank account number and records the export", async () => {
    await adminService.exportPartners("admin1", { status: "APPROVED", format: "excel" });
    const row = files[0].sheets[0].rows[0];
    assert.equal(row.bankAccountNumber, "******6789");
    assert.equal(row.approvalStatus, "Đã duyệt");
    assert.equal(row.accountStatus, "Đã khóa");
    assert.equal(row.phone, "");
    assert.equal(row.courts, 2);
    assert.equal(JSON.stringify(files[0]).includes("0123456789"), false);
    assert.deepEqual(audits.map((args) => [args[1], args[4]]), [["PARTNERS_EXPORTED", { filters: "Đã duyệt", rows: 1, format: "excel" }]]);
  });
});
