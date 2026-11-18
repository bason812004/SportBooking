/** Types an admin sends by hand (the backend accepts only these for a new campaign). */
export const campaignTypeOptions = [
  { value: "SYSTEM", label: "Hệ thống" },
  { value: "MAINTENANCE", label: "Bảo trì" },
  { value: "INCIDENT", label: "Sự cố" },
  { value: "FINANCE", label: "Tài chính" },
  { value: "PROMOTION", label: "Khuyến mãi" }
];

/** Labels of every campaign type, the ones from before the list was narrowed included, so old history still reads. */
const campaignTypeLabels: Record<string, string> = {
  ...Object.fromEntries(campaignTypeOptions.map((option) => [option.value, option.label])),
  APPROVAL: "Duyệt",
  REJECTION: "Từ chối",
  COURT_UPDATE_REQUESTED: "Yêu cầu cập nhật sân"
};

const campaignTypeTones: Record<string, string> = {
  SYSTEM: "bg-slate-100 text-slate-700",
  MAINTENANCE: "bg-sky-100 text-sky-700",
  INCIDENT: "bg-red-100 text-red-700",
  FINANCE: "bg-amber-100 text-amber-700",
  PROMOTION: "bg-emerald-100 text-emerald-700",
  APPROVAL: "bg-emerald-100 text-emerald-700",
  REJECTION: "bg-rose-100 text-rose-700",
  COURT_UPDATE_REQUESTED: "bg-sky-100 text-sky-700"
};

export type AudienceKey = "CUSTOMERS" | "PARTNERS" | "STAFF" | "ALL" | "ONE_USER" | "ONE_PARTNER" | "SELECTED";
export type GroupAudienceKey = Extract<AudienceKey, "CUSTOMERS" | "PARTNERS" | "STAFF" | "ALL">;

/** The whole groups a campaign can go to ("Nhóm chung" in the recipient picker); each maps to the API's target. */
export const groupAudiences: Array<{ value: GroupAudienceKey; label: string; targetType: "ROLE" | "ALL"; targetRole?: string }> = [
  { value: "CUSTOMERS", label: "Tất cả khách hàng", targetType: "ROLE", targetRole: "USER" },
  { value: "PARTNERS", label: "Tất cả đối tác", targetType: "ROLE", targetRole: "PARTNER" },
  { value: "STAFF", label: "Tất cả nhân viên sân", targetType: "ROLE", targetRole: "RECIPIENT" },
  { value: "ALL", label: "Mọi tài khoản (trừ bạn)", targetType: "ALL" }
];

/**
 * Who a new campaign goes to until the admin picks: system, maintenance and incident notices concern everyone,
 * money matters the partners, promotions the customers. The admin confirms the count before anything is sent.
 */
export const defaultAudienceByType: Record<string, GroupAudienceKey> = {
  SYSTEM: "ALL",
  MAINTENANCE: "ALL",
  INCIDENT: "ALL",
  FINANCE: "PARTNERS",
  PROMOTION: "CUSTOMERS"
};

/** Every audience a sent campaign can have, for the history filter (one partner only in campaigns sent before). */
export const audienceOptions: Array<{ value: AudienceKey; label: string; targetType: string; targetRole?: string }> = [
  ...groupAudiences,
  { value: "ONE_USER", label: "Một tài khoản", targetType: "USER" },
  { value: "SELECTED", label: "Nhiều tài khoản chọn riêng", targetType: "USERS" },
  { value: "ONE_PARTNER", label: "Một đối tác", targetType: "PARTNER" }
];

export const roleLabels: Record<string, string> = {
  USER: "Khách hàng",
  PARTNER: "Đối tác",
  RECIPIENT: "Nhân viên sân",
  ADMIN: "Quản trị viên"
};

/** The audience of a sent campaign in words, e.g. "Tất cả khách hàng" or "Nguyễn An (an@mail.com)". */
export function campaignTargetLabel(campaign: {
  targetType: string;
  targetRole?: string | null;
  targetUserId?: string | null;
  targetUserName?: string | null;
  targetUserEmail?: string | null;
  targetPartnerId?: string | null;
  targetPartnerName?: string | null;
  recipientCount?: number;
}) {
  if (campaign.targetType === "ALL") return "Mọi tài khoản";
  if (campaign.targetType === "USERS") return `${campaign.recipientCount ?? "Nhiều"} tài khoản chọn riêng`;
  if (campaign.targetType === "ROLE") {
    return audienceOptions.find((option) => option.targetRole === campaign.targetRole)?.label
      ?? `Tất cả ${(roleLabels[campaign.targetRole ?? ""] ?? campaign.targetRole ?? "").toLowerCase()}`;
  }
  if (campaign.targetType === "USER") {
    if (campaign.targetUserName) return `${campaign.targetUserName}${campaign.targetUserEmail ? ` (${campaign.targetUserEmail})` : ""}`;
    return campaign.targetUserEmail ?? campaign.targetUserId ?? "Một tài khoản";
  }
  if (campaign.targetType === "PARTNER") return `Đối tác ${campaign.targetPartnerName ?? campaign.targetPartnerId ?? ""}`.trim();
  return campaign.targetType;
}

export function campaignTypeLabel(type: string) {
  return campaignTypeLabels[type] ?? null;
}

export function campaignTypeTone(type: string) {
  return campaignTypeTones[type] ?? "bg-slate-100 text-slate-700";
}
