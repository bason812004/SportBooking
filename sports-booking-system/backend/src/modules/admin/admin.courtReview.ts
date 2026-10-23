/**
 * Trust signals shown to an admin reviewing a pending court. Only blockers stop approval (enforced again
 * in adminRepository.approvePendingCourt); the other checks are hints for the admin to weigh.
 */
export type CourtReviewInput = {
  courtStatus: string;
  partnerStatus: string;
  publishedImages: number;
  pendingImages: number;
  duplicateAddressCourts: number;
  partnerRejectedCourts: number;
  accountCreatedAt: Date;
  emailVerified: boolean;
  phone?: string | null;
  taxCode?: string | null;
  verificationDocumentUrl?: string | null;
  bankAccountHolder?: string | null;
  now?: Date;
};

export type CourtReviewCheck = {
  key: string;
  status: "ok" | "warning" | "missing";
  label: string;
};

export const NEW_ACCOUNT_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const present = (value?: string | null) => Boolean(value?.trim());

export function courtReviewChecks(input: CourtReviewInput) {
  const blockers: string[] = [];
  if (input.courtStatus !== "PENDING") blockers.push("Sân không còn ở trạng thái chờ duyệt");
  if (input.partnerStatus !== "APPROVED") {
    blockers.push(input.partnerStatus === "REJECTED" ? "Hồ sơ đối tác đã bị từ chối" : "Đối tác chưa được duyệt hồ sơ");
  }

  const totalImages = input.publishedImages + input.pendingImages;
  const accountDays = Math.max(0, Math.floor(((input.now ?? new Date()).getTime() - input.accountCreatedAt.getTime()) / DAY_MS));
  const info = (key: string, ok: boolean, okLabel: string, missingLabel: string): CourtReviewCheck =>
    ({ key, status: ok ? "ok" : "missing", label: ok ? okLabel : missingLabel });
  const warn = (key: string, ok: boolean, okLabel: string, warningLabel: string): CourtReviewCheck =>
    ({ key, status: ok ? "ok" : "warning", label: ok ? okLabel : warningLabel });

  const checks: CourtReviewCheck[] = [
    info(
      "partner_approved",
      input.partnerStatus === "APPROVED",
      "Đối tác đã được duyệt hồ sơ",
      input.partnerStatus === "REJECTED" ? "Hồ sơ đối tác đã bị từ chối" : "Đối tác chưa được duyệt hồ sơ"
    ),
    warn("images", totalImages > 0, `Có ${totalImages} ảnh sân`, "Sân chưa có ảnh nào"),
    ...(input.pendingImages > 0
      ? [{ key: "pending_images", status: "warning" as const, label: `Còn ${input.pendingImages} ảnh chưa xét duyệt` }]
      : []),
    warn(
      "duplicate_address",
      input.duplicateAddressCourts === 0,
      "Không trùng địa chỉ với đối tác khác",
      `Địa chỉ trùng với ${input.duplicateAddressCourts} sân của đối tác khác`
    ),
    warn(
      "rejected_history",
      input.partnerRejectedCourts === 0,
      "Đối tác chưa từng bị từ chối sân",
      `Đối tác từng bị từ chối ${input.partnerRejectedCourts} sân`
    ),
    warn(
      "account_age",
      accountDays >= NEW_ACCOUNT_DAYS,
      `Tài khoản đã tạo ${accountDays} ngày`,
      accountDays === 0 ? "Tài khoản mới tạo hôm nay" : `Tài khoản mới tạo ${accountDays} ngày`
    ),
    info("email_verified", input.emailVerified, "Email đã xác minh", "Email chưa xác minh"),
    info("phone", present(input.phone), "Có số điện thoại liên hệ", "Chưa có số điện thoại"),
    info("tax_code", present(input.taxCode), "Có mã số thuế", "Chưa khai mã số thuế"),
    info("verification_document", present(input.verificationDocumentUrl), "Có giấy tờ xác minh", "Chưa có giấy tờ xác minh"),
    info("bank_account", present(input.bankAccountHolder), "Có chủ tài khoản ngân hàng", "Chưa khai tài khoản ngân hàng")
  ];

  return { canApprove: blockers.length === 0, blockers, checks };
}
