import assert from "node:assert/strict";
import { test } from "node:test";
import { activationProblem, normalizeVoucherTerms, runningVoucherChanges } from "./voucher.terms.js";

const base = {
  code: " summer20 ",
  title: "Hè sôi động",
  discountType: "PERCENTAGE" as const,
  discountValue: 20,
  maxDiscountAmount: 100000,
  startDate: "2026-11-01T00:00:00.000Z",
  endDate: "2026-12-01T00:00:00.000Z"
};

test("terms are stored normalized: upper-case code, no cap on fixed amounts, empty conditions mean no restriction", () => {
  const terms = normalizeVoucherTerms(base);
  assert.equal(terms.code, "SUMMER20");
  assert.equal(terms.applicableDays, null);
  assert.equal(terms.holidayDates, null);
  assert.equal(normalizeVoucherTerms({ ...base, discountType: "FIXED_AMOUNT", discountValue: 50000 }).maxDiscountAmount, null);
  assert.equal(normalizeVoucherTerms({ ...base, applicableDays: ["SUNDAY", "MONDAY", "MONDAY"] }).applicableDays, "MONDAY,SUNDAY");
  assert.equal(
    normalizeVoucherTerms({ ...base, applicableDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] }).applicableDays,
    null,
    "all seven days is no restriction"
  );
});

test("rules a field schema cannot see are refused", () => {
  assert.throws(() => normalizeVoucherTerms({ ...base, discountValue: 120 }), /100%/);
  assert.throws(() => normalizeVoucherTerms({ ...base, endDate: base.startDate }), /trước ngày kết thúc/);
  assert.throws(() => normalizeVoucherTerms({ ...base, startTime: "18:00", endTime: "06:00" }), /Giờ bắt đầu/);
  assert.throws(() => normalizeVoucherTerms({ ...base, applicableStartDate: "2026-12-10", applicableEndDate: "2026-12-01" }), /Ngày chơi/);
});

test("a running voucher only changes wording, end date and usage limit", () => {
  const current = { startDate: "2026-10-01T00:00:00.000Z", usedCount: 12 };
  const now = new Date("2026-10-24T00:00:00.000Z");
  assert.deepEqual(runningVoucherChanges(current, { title: " Mới ", usageLimit: 50 }, now), { title: "Mới", usageLimit: 50 });
  assert.throws(() => runningVoucherChanges(current, { discountValue: 30 }, now), /chỉ sửa được/);
  assert.throws(() => runningVoucherChanges(current, { usageLimit: 5 }, now), /số lượt đã dùng \(12\)/);
  assert.throws(() => runningVoucherChanges(current, { endDate: "2026-10-01T00:00:00.000Z" }, now), /tương lai/);
  assert.equal(runningVoucherChanges(current, { usageLimit: null }, now).usageLimit, null, "unlimited is allowed");
});

test("activation needs a draft or disabled voucher with time and uses left", () => {
  const now = new Date("2026-10-24T00:00:00.000Z");
  const voucher = { status: "DRAFT", endDate: "2026-12-01T00:00:00.000Z", usageLimit: 10, usedCount: 0 };
  assert.equal(activationProblem(voucher, now), null);
  assert.match(activationProblem({ ...voucher, status: "ACTIVE" }, now)!, /đang hoạt động/);
  assert.match(activationProblem({ ...voucher, status: "EXPIRED" }, now)!, /không thể kích hoạt/);
  assert.match(activationProblem({ ...voucher, endDate: "2026-10-01T00:00:00.000Z" }, now)!, /hết hạn/);
  assert.match(
    activationProblem({ ...voucher, status: "EXPIRED", endDate: "2026-10-01T00:00:00.000Z" }, now)!,
    /gia hạn/,
    "an expired voucher is told to be extended, not just refused"
  );
  assert.match(activationProblem({ ...voucher, usedCount: 10 }, now)!, /hết lượt/);
});
