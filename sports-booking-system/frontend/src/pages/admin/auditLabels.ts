/** Vietnamese names for the audit log's codes; an unknown code is shown as it is. */
const ACTION_LABELS: Record<string, string> = {
  AUDIT_CHAIN_RESEALED: "Niêm phong lại chuỗi nhật ký",
  BLOG_COMMENT_DELETED: "Xoá bình luận bài viết",
  BLOG_COMMENT_REMOVED: "Gỡ bình luận bài viết",
  BLOG_HIDDEN: "Ẩn bài viết",
  BLOG_PUBLISHED: "Duyệt bài viết",
  BLOG_REJECTED: "Từ chối bài viết",
  BOOKING_ADMIN_UPDATED: "Sửa đơn đặt sân",
  BOOKING_AUTO_FINISHED: "Hệ thống tự kết thúc đơn quá hạn",
  BOOKING_CANCELLED: "Huỷ đơn đặt sân",
  BOOKING_CREATED: "Tạo đơn đặt sân",
  CATEGORY_CREATED: "Tạo danh mục",
  CATEGORY_DISABLED: "Tắt danh mục",
  CATEGORY_UPDATED: "Sửa danh mục",
  COMMISSION_DEBT_PAID: "Ghi nhận trả công nợ hoa hồng",
  COMMISSION_DEFAULT_UPDATED: "Đổi tỷ lệ hoa hồng mặc định",
  COURT_ADMIN_UPDATED: "Cập nhật sân (quản trị)",
  COURT_APPROVED: "Duyệt sân",
  COURT_REJECTED: "Từ chối sân",
  COURT_APPROVAL_REVOKED: "Hủy duyệt sân",
  COURT_UPDATE_REQUESTED: "Yêu cầu cập nhật sân",
  NOTIFICATION_CAMPAIGN_RECALLED: "Thu hồi thông báo",
  NOTIFICATION_CAMPAIGN_SENT: "Gửi thông báo",
  PARTNER_APPROVED: "Duyệt đối tác",
  PARTNERS_EXPORTED: "Xuất danh sách đối tác",
  CUSTOMERS_EXPORTED: "Xuất danh sách khách hàng",
  PARTNER_COMMISSION_UPDATED: "Đổi tỷ lệ hoa hồng đối tác",
  PARTNER_REJECTED: "Từ chối đối tác",
  REPORT_REJECTED: "Bác bỏ báo cáo vi phạm",
  REPORT_RESOLVED: "Xử lý báo cáo vi phạm",
  REVIEW_DELETED: "Xoá đánh giá",
  REVIEW_HIDDEN: "Ẩn đánh giá",
  REVIEW_REPLY_REMOVED: "Gỡ phản hồi đánh giá",
  REVIEW_RESTORED: "Hiện lại đánh giá",
  SETTLEMENT_CANCELLED: "Huỷ / thu hồi quyết toán",
  SETTLEMENT_COMPLETED: "Quyết toán",
  TEAM_POST_REMOVED: "Gỡ bài tìm đồng đội",
  TOURNAMENT_APPROVED: "Duyệt giải đấu",
  TOURNAMENT_REJECTED: "Từ chối giải đấu",
  USER_LOCKED: "Khoá tài khoản",
  USER_UNLOCKED: "Mở khoá tài khoản",
  VOUCHER_ACTIVE: "Kích hoạt voucher",
  VOUCHER_CREATED: "Tạo voucher",
  VOUCHER_DISABLED: "Tắt voucher",
  VOUCHER_UPDATED: "Sửa voucher",
  WALLETS_RECONCILED: "Đối chiếu ví đối tác",
  WITHDRAWAL_APPROVED: "Duyệt rút tiền",
  WITHDRAWAL_AUTO_APPROVED: "Tự duyệt rút tiền",
  WITHDRAWAL_FAILED: "Chuyển khoản thất bại",
  WITHDRAWAL_PAID: "Đã chuyển khoản rút tiền",
  WITHDRAWAL_REJECTED: "Từ chối rút tiền"
};

const ENTITY_LABELS: Record<string, string> = {
  AUDIT_LOG: "Nhật ký kiểm toán",
  BLOG: "Bài viết",
  BOOKING: "Đơn đặt sân",
  CATEGORY: "Danh mục",
  COURT: "Sân",
  NOTIFICATION_CAMPAIGN: "Thông báo",
  PARTNER: "Đối tác",
  PARTNER_WALLET: "Ví đối tác",
  REPORT: "Báo cáo vi phạm",
  REVIEW: "Đánh giá",
  SETTLEMENT: "Quyết toán",
  SYSTEM_SETTING: "Cấu hình hệ thống",
  TEAM_POST: "Bài tìm đồng đội",
  TOURNAMENT: "Giải đấu",
  USER: "Tài khoản",
  VOUCHER: "Voucher",
  WITHDRAWAL: "Rút tiền"
};

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Quản trị viên",
  PARTNER: "Đối tác",
  RECIPIENT: "Nhân viên sân",
  USER: "Khách hàng",
  SYSTEM: "Hệ thống"
};

const METADATA_LABELS: Record<string, string> = {
  amount: "Số tiền",
  bookingCode: "Mã đơn",
  bookingId: "Đơn đặt sân",
  checkedIn: "Đã check-in",
  courtDue: "Tiền sân phải trả",
  checked: "Số bản ghi kiểm tra",
  comment: "Nội dung",
  courtId: "Sân",
  netAmount: "Đối tác nhận",
  note: "Ghi chú",
  onlinePaid: "Đã trả online",
  ownerId: "Chủ bài",
  partnerId: "Đối tác",
  partnersUsingDefault: "Số đối tác dùng mặc định",
  paymentId: "Mã thanh toán",
  previousRate: "Tỷ lệ cũ",
  previousStatus: "Trạng thái trước",
  provider: "Cổng chuyển khoản",
  rate: "Tỷ lệ mới",
  rating: "Số sao",
  reason: "Lý do",
  reference: "Mã giao dịch",
  replacedHashes: "Hash đã thay",
  repliedBy: "Người phản hồi",
  reply: "Phản hồi",
  resealed: "Số bản ghi niêm phong lại",
  status: "Trạng thái",
  title: "Tiêu đề",
  userId: "Tài khoản"
};

export const actionLabel = (action: string) => ACTION_LABELS[action] ?? action;
export const entityLabel = (entityType: string) => ENTITY_LABELS[entityType] ?? entityType;
export const metadataLabel = (key: string) => METADATA_LABELS[key] ?? key;

const MONEY_KEYS = new Set(["onlinePaid", "courtDue"]);

/** Amounts as money, lists by their length, other objects as JSON. */
export function metadataValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (typeof value === "number" && (/amount/i.test(key) || MONEY_KEYS.has(key))) return `${value.toLocaleString("vi-VN")} đ`;
  if ((key === "rate" || key === "previousRate") && typeof value === "number") return `${value}%`;
  if (Array.isArray(value)) return `${value.length} mục`;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function actionTone(action: string) {
  const value = action.toUpperCase();
  if (/REJECT|DISABLE|DELETE|REMOVE|LOCKED|CANCEL|HIDDEN|RECALL|FAILED/.test(value) && !value.includes("UNLOCK")) {
    return "bg-red-100 text-red-700";
  }
  if (/APPROVE|CREATE|ACTIVE|UNLOCK|RESOLVE|PUBLISH|PAID|COMPLETED|RESTORED|SENT/.test(value)) {
    return "bg-emerald-100 text-emerald-700";
  }
  if (/UPDATE|EDIT|RECONCILED|RESEALED/.test(value)) return "bg-blue-100 text-blue-700";
  return "bg-slate-100 text-slate-700";
}
