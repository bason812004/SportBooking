export type Role = "USER" | "PARTNER" | "ADMIN" | "RECIPIENT";

export type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data: T;
  errors?: Record<string, string[]>;
};

export type User = {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  role: Role;
  status: "ACTIVE" | "LOCKED";
  partnerProfile?: {
    id: string;
    businessName: string;
    approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  };
};

/** A row of the admin users list. */
export type AdminUser = Pick<User, "id" | "fullName" | "email" | "phone" | "avatarUrl" | "role" | "status"> & {
  createdAt: string;
  partnerProfile?: { businessName: string } | null;
  /** Staff accounts: the court they run the counter of. */
  managedCourt?: { name: string } | null;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  status: "ACTIVE" | "INACTIVE";
};

/** A category as the admin list returns it, with how many courts use it. */
export type AdminCategory = Category & { _count: { courts: number } };

export type Court = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  address: string;
  city: string;
  /** Only on courts registered before the 2025 reform (no district level any more). */
  district?: string | null;
  ward?: string | null;
  latitude?: number;
  longitude?: number;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  activeStatus: "ACTIVE" | "INACTIVE";
  openingTime: string;
  closingTime: string;
  mapUrl?: string;
  contactPhone?: string;
  contactEmail?: string;
  facebookUrl?: string;
  sourceUrl?: string;
  verified?: boolean;
  courtCount?: number;
  surfaceCount?: number;
  priceNote?: string;
  goldenPriceNote?: string;
  depositPercent?: number | null;
  articleContent?: string;
  directions?: string;
  surfaceInfo?: string;
  minPrice?: number | null;
  distanceKm?: number | null;
  averageRating?: number | null;
  reviewCount?: number;
  /** Partner pages: what an admin said about the court. */
  rejectionReason?: string | null;
  updateRequestNote?: string | null;
  updateRequestedAt?: string | null;
  /** Locked by an admin: the partner cannot reopen it. */
  adminLockedAt?: string | null;
  adminLockReason?: string | null;
  category: Category;
  partner?: {
    id: string;
    businessName: string;
    address?: string | null;
    approvalStatus?: "PENDING" | "APPROVED" | "REJECTED";
    user?: { fullName: string; email: string; phone?: string | null };
  };
  images: Array<{ id: string; imageUrl: string; publicId?: string; sortOrder: number }>;
  surfaces?: Array<{ id: string; code: string; name: string; capacity?: string; surface?: string; size?: string; imageUrl?: string; sortOrder: number; openingTime?: string | null; closingTime?: string | null }>;
  amenities: Array<{ id: string; name: string }>;
  prices: Array<{ id: string; dayType: string; startTime: string; endTime: string; price: string; note?: string }>;
  services: Array<{ id: string; name: string; description?: string; price: string; status: string }>;
  reviews?: Array<{
    id: string;
    rating: number;
    comment?: string | null;
    createdAt: string;
    updatedAt?: string;
    isEdited?: boolean;
    user: { id: string; fullName: string; avatarUrl?: string | null };
    /** The court owner's public reply. */
    reply?: { content: string; repliedAt: string; businessName: string | null } | null;
  }>;
  ratingBreakdown?: Array<{ rating: number; count: number; percent: number }>;
  nearbyCourts?: Court[];
};

export type BookingService = {
  id: string;
  serviceId: string;
  quantity: number;
  price: string;
  unitPrice?: number | string;
  totalPrice?: number | string;
  status?: string;
  service: {
    id: string;
    name: string;
    description?: string | null;
    price: string;
    imageUrl?: string | null;
    unit?: string;
  };
};

export type BookingVoucherInfo = {
  id: string;
  bookingId: string;
  voucherId: string;
  discountAmount: string;
  voucher: {
    id: string;
    code: string;
    title: string;
    discountType: "PERCENTAGE" | "FIXED_AMOUNT";
    discountValue: number;
    partner?: { id: string; businessName: string } | null;
    court?: { id: string; name: string; city: string; district: string } | null;
  };
};

/** Live bill of a booking, computed by the backend (same numbers as its checkout). */
export type BookingBill = {
  subtotalCourt: number;
  subtotalService: number;
  discount: number;
  depositPaid: number;
  totalPaid: number;
  remainingAmount: number;
  totalAmount: number;
  isFullyPaid: boolean;
  /** Active services on the booking; their lineTotal values add up to subtotalService. */
  services: Array<{ id: string; name: string; quantity: number; lineTotal: number }>;
};

/** A booking over but still open (not checked in, or never checked out), and when the system finishes it. */
export type OverdueBooking = {
  id: string;
  courtId: string;
  courtName: string;
  bookingCode: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  bookingStatus: string;
  customerName: string | null;
  finishesAt: string;
};

export type Booking = {
  id: string;
  bookingCode: string;
  /** The system finished it after it stayed open too long; an automatic no-show can be corrected for 7 days. */
  autoFinishedAt?: string | null;
  bookingOrderId?: string | null;
  bookingDate: string;
  startTime: string;
  endTime: string;
  createdAt: string;
  updatedAt?: string;
  basePrice?: string;
  dynamicAdjustmentAmount?: string;
  subtotal?: string;
  voucherDiscountAmount?: string;
  totalPrice: string;
  demandPredictionSnapshot?: DemandPrediction | null;
  paymentMethod: string;
  paymentStatus: string;
  bookingStatus: string;
  cancelReason?: string | null;
  note?: string | null;
  cancelledAt?: string | null;
  depositAmount?: string;
  refundAmount?: string;
  platformRetainedAmount?: string;
  court: Court;
  courtSurface?: { id: string; name: string; code: string } | null;
  user?: { id?: string; fullName: string; email?: string; phone?: string };
  // Superset of both shapes the API returns: the list endpoints send Date objects and
  // courtSurfaceId, the detail endpoint sends strings plus bookingDate/court_surfaces.
  bookingSlots?: Array<{
    id: string;
    bookingDate?: string;
    startTime: string | Date;
    endTime: string | Date;
    slotPrice?: number | string;
    basePrice?: number | string;
    courtSurfaceId?: string | null;
    court_surfaces?: { id: string; name: string; code: string } | null;
  }>;
  bookingServices?: BookingService[];
  bookingVoucher?: BookingVoucherInfo | null;
  payments?: Array<{
    id: string;
    status: string;
    amount: string;
    paymentMethod: string;
    paymentType: string;
    expiresAt?: string;
    createdAt: string;
  }>;
  review?: {
    id: string;
    rating: number;
    comment?: string | null;
    createdAt: string;
  } | null;
};

export type PartnerProfile = {
  id: string;
  businessName: string;
  address: string;
  verificationDocumentUrl?: string | null;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountHolder?: string | null;
  /** When the payout account was last set or changed: withdrawals open 24 hours later. */
  bankAccountChangedAt?: string | null;
  taxCode?: string | null;
  user: { fullName: string; email: string; phone?: string | null; avatarUrl?: string | null };
  /** The partner's own profile only: the latest admin decision, so a rejected partner sees why. */
  latestReview?: { action: string; reason?: string | null; createdAt: string } | null;
};

export type PartnerDashboard = {
  courts: number;
  bookingsToday: number;
  revenue: number;
  pendingBookings: number;
  revenueGrowth: number | null;
  trend: Array<{ date: string; bookings: number }>;
  courtStatuses: Array<{
    id: string;
    name: string;
    bookings: Array<{ bookingStatus: string; startTime: string; endTime: string }>;
  }>;
  recentBookings: Booking[];
};

export type PartnerBlog = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  coverImageUrl?: string | null;
  status: string;
  visibility: "PUBLIC" | "PRIVATE";
  allowComments?: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  rejectionReason?: string | null;
  /** Why an admin hid the post, while it is hidden. */
  hiddenReason?: string | null;
};

export type PartnerTournament = {
  id: string;
  courtId: string;
  courtName: string;
  title: string;
  slug: string;
  description?: string | null;
  sportType: string;
  coverImageUrl?: string | null;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  maxParticipants: number;
  currentParticipants: number;
  entryFee: number;
  prizeDescription?: string | null;
  status: string;
  createdAt: string;
};

export type AdminDashboard = {
  users: number;
  partners: number;
  courts: number;
  /** Courts in operation: approved by an admin. */
  approvedCourts: number;
  bookings: number;
  pendingCourts: number;
  pendingPartners: number;
  financials: { gmv: number; refunds: number; platformCommission: number; partnerPayout: number };
  trend: Array<{ date: string; bookings: number; gmv: number }>;
  pendingItems: Court[];
};

/** A row of the admin partner list: no tax code or bank details, only how many review items are missing. */
export type AdminPartnerListItem = Pick<PartnerProfile, "id" | "businessName" | "approvalStatus" | "verificationDocumentUrl"> & {
  createdAt: string;
  user: { id: string; fullName: string; email: string; phone?: string | null; status: "ACTIVE" | "LOCKED" };
  courtCount: number;
  missingChecks: number;
};

export type AdminPartner = Omit<PartnerProfile, "user"> & {
  createdAt: string;
  /** A partner-specific rate; null means the system default applies. */
  commissionRate?: number | null;
  user: { id: string; fullName: string; email: string; phone?: string | null; status: "ACTIVE" | "LOCKED"; createdAt: string };
  courts?: Array<{ id: string; name: string; approvalStatus: string; activeStatus: string }>;
  history?: Array<{ id: string; action: string; reason?: string; createdAt: string }>;
  checks?: CourtReviewCheck[];
};

export type BookingAdminAction = {
  id: string;
  action: string;
  note?: string | null;
  previousStatus?: Record<string, unknown> | null;
  newStatus?: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; fullName: string; email: string };
};

export type AdminBooking = Omit<Booking, "court"> & {
  createdAt: string;
  updatedAt?: string;
  cancelReason?: string | null;
  adminNote?: string | null;
  court: {
    id: string;
    name: string;
    address?: string;
    city?: string;
    district?: string;
    partner?: { id: string; businessName: string; address?: string; user?: { id: string; fullName: string; email: string; phone?: string } };
  };
  /** List rows only: the booking's bill total (court + services - voucher). */
  billTotal?: number;
  /** Detail only. */
  bill?: BookingBill;
  adminActions?: BookingAdminAction[];
};

export type AdminBookingFilterOptions = {
  partners: Array<{ id: string; businessName: string }>;
  courts: Array<{ id: string; name: string; partnerId: string }>;
};

export type AdminCourt = Omit<Court, "category" | "images" | "prices" | "services" | "amenities"> & {
  featured?: boolean;
  adminNote?: string | null;
  updateRequestNote?: string | null;
  updateRequestedAt?: string | null;
  imageUrl?: string | null;
  category?: Category;
  partner: {
    id: string;
    businessName: string;
    address?: string | null;
    user: { id?: string; fullName: string; email: string; phone?: string | null };
  };
  images?: Array<{ id: string; imageUrl: string; sortOrder: number }>;
  prices?: Array<{ id: string; dayType: string; startTime: string; endTime: string; price: number | string; note?: string | null }>;
  services?: Array<{ id: string; name: string; description?: string | null; price: number | string; status: string }>;
};

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

/** A court waiting for approval, as listed on /admin/courts/pending. */
export type AdminPendingCourt = Court & {
  partner: { id: string; businessName: string; approvalStatus: ApprovalStatus; user: { fullName: string; email: string } };
  imageRequests: Array<{ imageUrl: string }>;
  _count: { images: number; imageRequests: number; surfaces: number };
};

/** What revoking a court approval would leave standing: the upcoming bookings whose customers are told. */
export type CourtApprovalRevocation = {
  revocableUntil: string | null;
  bookings: Array<{ id: string; bookingCode: string; bookingDate: string; startTime: string; endTime: string; customerName: string; surfaceName: string | null }>;
};

export type CourtReviewCheck = { key: string; status: "ok" | "warning" | "missing"; label: string };

/** GET /admin/courts/:id/review: what an admin needs to judge whether a submitted court is real. */
export type AdminCourtReview = {
  id: string;
  name: string;
  description?: string | null;
  address: string;
  ward?: string | null;
  district?: string | null;
  city: string;
  latitude: number | null;
  longitude: number | null;
  mapUrl?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  openingTime: string;
  closingTime: string;
  courtCount: number;
  approvalStatus: ApprovalStatus;
  activeStatus: string;
  rejectionReason?: string | null;
  updateRequestNote?: string | null;
  createdAt: string;
  depositPercent: number | null;
  category: { id: string; name: string };
  surfaces: Array<{ id: string; code: string; name: string; surface?: string | null; size?: string | null; status: string }>;
  images: Array<{ id: string; imageUrl: string; sortOrder: number }>;
  imageRequests: Array<{
    id: string;
    imageUrl: string;
    previousImageUrl: string | null;
    replaceImageId: string | null;
    status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
    reason: string | null;
    createdAt: string;
  }>;
  prices: Array<{ id: string; dayType: string; startTime: string; endTime: string; price: number; note?: string | null }>;
  partner: {
    id: string;
    businessName: string;
    address: string;
    approvalStatus: ApprovalStatus;
    taxCode?: string | null;
    verificationDocumentUrl?: string | null;
    bankName?: string | null;
    bankAccountNumber?: string | null;
    bankAccountHolder?: string | null;
    user: { id: string; fullName: string; email: string; phone?: string | null; emailVerified: boolean; status: string; createdAt: string };
  };
  partnerCourts: Record<ApprovalStatus, number>;
  duplicateAddressCourts: Array<{ id: string; name: string; approvalStatus: ApprovalStatus; partner: { businessName: string } }>;
  history: Array<{ id: string; action: string; reason?: string | null; createdAt: string; actor?: { fullName?: string | null; email?: string | null } | null }>;
  /** Until when the approval can be taken back (a short window after approving); null when it cannot. */
  revocableUntil: string | null;
  review: { canApprove: boolean; blockers: string[]; checks: CourtReviewCheck[] };
};

export type VoucherDayKey = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";

/** When a voucher applies, beyond its validity period: play days, a time window, holidays, a range of play dates. */
export type VoucherConditionsInput = {
  applicableDays?: VoucherDayKey[] | null;
  startTime?: string | null;
  endTime?: string | null;
  holidayOnly?: boolean;
  holidayDates?: string[] | null;
  applicableStartDate?: string | null;
  applicableEndDate?: string | null;
};

/** The only changes a voucher accepts once it has been activated. */
export type VoucherRunningInput = {
  title?: string;
  description?: string | null;
  endDate?: string;
  usageLimit?: number | null;
};

export type AdminVoucher = {
  id: string; code: string; title: string; discountType: string; discountValue: number;
  maxDiscountAmount?: number | null; minBookingAmount: number;
  usedCount: number; usageLimit?: number | null; startDate: string; endDate: string;
  status: string; partnerId: string | null; businessName: string | null; courtName?: string | null;
  /** An admin disabled this partner voucher; only an admin can turn it back on. */
  lockedByAdmin: boolean;
  /** The reason the admin gave, while the voucher is locked. */
  lockReason: string | null;
  /** Who pays the discount: the platform for admin vouchers, the partner for its own. */
  fundedBy: "PARTNER" | "PLATFORM" | "SHARED";
  createdAt: string;
  applicableDays: string | null; startTime: string | null; endTime: string | null;
  holidayOnly: boolean; holidayDates: string[]; applicableStartDate: string | null; applicableEndDate: string | null;
};

export type AdminVoucherDetail = {
  id: string; code: string; title: string; description?: string | null;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT"; discountValue: number; maxDiscountAmount?: number | null;
  minBookingAmount: number; usedCount: number; usageLimit?: number | null; startDate: string; endDate: string;
  status: string; partnerId: string | null; businessName: string | null; lockedByAdmin: boolean;
  lockReason: string | null; fundedBy: "PARTNER" | "PLATFORM" | "SHARED";
  courtId: string | null; courtName: string | null;
  applicableDays: string | null; startTime: string | null; endTime: string | null;
  holidayOnly: boolean; holidayDates: string[]; applicableStartDate: string | null; applicableEndDate: string | null;
};

export type AdminVoucherInput = VoucherConditionsInput & {
  courtId?: string | null;
  code: string;
  title: string;
  description?: string | null;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  maxDiscountAmount?: number | null;
  minBookingAmount: number;
  usageLimit?: number | null;
  startDate: string;
  endDate: string;
};

/** A review as the admin moderation list and the partner's reviews page show it (partners do not get the email). */
export type ModeratedReview = {
  id: string;
  rating: number;
  comment: string | null;
  displayStatus: "VISIBLE" | "HIDDEN";
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  user: { id: string; fullName: string; email?: string };
  court: { id: string; name: string; partner: { id: string; businessName: string } | null };
  booking: { id: string; bookingCode: string; bookingDate: string; bookingStatus: string } | null;
  /** Attached to a booking of the reviewer that was completed: they played there. */
  verified: boolean;
  /** The court owner's public reply; repliedAt is when it was last written. */
  reply: { content: string; repliedAt: string } | null;
  /** The last admin decision (hidden, shown again) and its reason. */
  moderation: { action: string; reason: string | null; createdAt: string } | null;
  /** An admin took the court owner's reply down; it cannot be posted again. */
  replyRemoval?: { reason: string | null; removedAt: string } | null;
};

/** Average of the visible reviews, how many are hidden, and how many got each star. */
export type ReviewSummary = {
  total: number;
  averageRating: number;
  hiddenCount: number;
  distribution: Array<{ rating: number; count: number }>;
};

/** A court or partner in the review statistics: its visible reviews and their average, hidden ones apart. */
export type ReviewStatsRank = {
  id: string;
  name: string;
  count: number;
  averageRating: number;
  hiddenCount: number;
  repliedCount: number;
  lowCount: number;
};

/** The admin's review statistics for one partner, court and period (the list's other filters do not apply). */
export type AdminReviewStats = {
  summary: ReviewSummary;
  /** Visible reviews the court owner replied to. */
  repliedCount: number;
  /** Visible 1–2 star reviews. */
  lowCount: number;
  /** Visible reviews per day (YYYY-MM-DD) or month (YYYY-MM); a period without one has no average. */
  trend: { unit: "day" | "month"; points: Array<{ period: string; count: number; averageRating: number | null }> };
  /** Lowest rated first. */
  courts: Array<ReviewStatsRank & { partnerId: string | null; partnerName: string | null }>;
  /** Lowest rated first. */
  partners: Array<ReviewStatsRank & { courtCount: number }>;
};

/** Whether the signed-in user may review the court now, and the booking the review would go with. */
export type ReviewEligibility = {
  canReview: boolean;
  reason: string | null;
  booking?: { id: string; bookingCode: string; bookingDate: string };
};

export type AuditLog = {
  id: string; action: string; entityType: string; entityId: string;
  metadata: Record<string, unknown> | null;
  previousHash?: string | null; currentHash: string; createdAt: string;
  /** Null for actions the system took on its own. */
  actor: { id: string; fullName: string; email: string; role: Role } | null;
};

/** An audit entry queued for anchoring on a blockchain; nothing anchors it while no provider is configured. */
export type BlockchainLog = {
  id: string; auditLogId?: string | null; entityType: string; entityId: string; payloadHash: string;
  network: string; txHash?: string | null; status: string; error?: string | null;
  attempts: number; confirmedAt?: string | null; createdAt: string;
  audit?: { id: string; action: string; createdAt: string; actor: { fullName: string } | null } | null;
};

export type AdminReport = {
  id: string;
  courtId: string;
  reason: string;
  description?: string | null;
  status: "PENDING" | "RESOLVED" | "REJECTED";
  createdAt: string;
  resolvedAt?: string | null;
  adminNote?: string | null;
  user: { id: string; fullName: string; email: string };
  court: { id: string; name: string; approvalStatus: string; activeStatus: string; partner?: { id: string; businessName: string } | null };
  resolver?: { id: string; fullName: string } | null;
  /** Reports still waiting on the same court, this one included when it waits. */
  courtPendingCount: number;
  /** Messages in the report's conversation, and who wrote the last one (a reporter's answer waits for an admin). */
  messageCount: number;
  lastMessage: { authorRole: "ADMIN" | "USER"; createdAt: string } | null;
};

export type ReportStatus = "PENDING" | "RESOLVED" | "REJECTED";

/** Something done about a reported court: SYSTEM ones come from the audit log, ADMIN ones were ticked by the admin. */
export type ReportMeasure = {
  code: string;
  label: string;
  detail?: string | null;
  source: "SYSTEM" | "ADMIN";
  auditId?: string;
  at?: string;
};

/** One entry of a report's conversation; the first is the report itself (kind REPORT, title = reason). */
export type ReportThreadEntry = {
  id: string;
  kind: "REPORT" | "MESSAGE" | "RESOLVED" | "REJECTED";
  authorRole: "ADMIN" | "USER";
  /** Null for an admin in the reporter's view. */
  authorName: string | null;
  title?: string;
  content: string;
  measures: ReportMeasure[];
  createdAt: string;
};

/** GET /reports/:id: the reporter's own report. */
export type MyReportThread = {
  id: string;
  status: ReportStatus;
  reason: string;
  description?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
  court: { id: string; name: string };
  entries: ReportThreadEntry[];
  canReply: boolean;
  repliesLeft: number;
};

/** GET /admin/reports/:id */
export type AdminReportThread = {
  report: Omit<AdminReport, "courtPendingCount" | "messageCount" | "lastMessage">;
  entries: ReportThreadEntry[];
  /** What the audit log shows was done about the court since the report came in (only while it waits). */
  detectedMeasures: ReportMeasure[];
  measureOptions: Array<{ code: string; label: string }>;
  otherPending: Array<{ id: string; reason: string; createdAt: string; reporterName: string }>;
};

export type ReportDecisionPayload = { note: string; measures?: string[]; auditIds?: string[]; applyToCourtPending?: boolean };

export type CommissionRateConfig = {
  partnerId: string;
  businessName: string;
  overrideRate: number | null;
  defaultRate: number;
  effectiveRate: number;
};

/** The default rate and who it reaches: partners without a rate of their own use it, the overrides do not. */
/** Why a partner's rate holds since that day (see backend commission.rateSince.ts). */
export type CommissionRateSinceReason = "OVERRIDE_SET" | "OVERRIDE_REMOVED" | "DEFAULT_CHANGED" | "JOINED";

export type CommissionDefault = {
  rate: number;
  /** The last change of the default in the audit log, else when the setting was last written. */
  defaultSince: string | null;
  defaultChangedBy: string | null;
  partnersUsingDefault: number;
  overrides: Array<{ partnerId: string; businessName: string; rate: number }>;
  /** Every partner's current rate and since when it applies. */
  partners: Array<{
    partnerId: string;
    businessName: string;
    rate: number;
    source: "DEFAULT" | "OVERRIDE";
    since: string;
    sinceReason: CommissionRateSinceReason;
    changedBy: string | null;
  }>;
};

export type CommissionRateChange = {
  id: string;
  action: "COMMISSION_DEFAULT_UPDATED" | "PARTNER_COMMISSION_UPDATED";
  entityId: string;
  metadata: { previousRate?: number | null; rate?: number | null; partnersUsingDefault?: number } | null;
  createdAt: string;
  actorName: string | null;
  businessName: string | null;
};

export type CommissionSummary = {
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  transactionCount: number;
};

export type CommissionReport = {
  month: string;
  summary: CommissionSummary;
  partners: Array<
    CommissionSummary & {
      partnerId: string;
      businessName: string;
    }
  >;
};

export type AdminFinanceTransaction = {
  id: string;
  bookingId: string;
  bookingCode: string;
  bookingDate: string;
  courtId: string;
  courtName: string;
  partnerId: string;
  businessName: string;
  transactionType: "EARNING" | "ADJUSTMENT" | "REVERSAL";
  eventType: "COMPLETED" | "NO_SHOW" | "REFUND";
  grossAmount: number;
  commissionRate: number;
  commissionAmount: number;
  netAmount: number;
  createdAt: string;
};

export type AdminRefund = {
  id: string;
  bookingCode: string;
  bookingDate: string;
  totalPrice: number;
  depositAmount: number;
  refundAmount: number;
  platformRetainedAmount: number;
  paymentStatus: string;
  cancelReason?: string | null;
  refundedAt: string;
  user: { id: string; fullName: string; email: string };
  court: { id: string; name: string; partner: { id: string; businessName: string } };
};

export type AdminFinancePartner = CommissionSummary & {
  partnerId: string;
  businessName: string;
  refundAmount: number;
  platformRetainedAmount: number;
  refundCount: number;
  /** Withdrawals transferred to the partner during the month. */
  paidOutAmount: number;
  paidOutCount: number;
  /** The wallet as it stands now (not at the month's end). */
  walletPending: number;
  walletAvailable: number;
  commissionDebt: number;
};

export type AdminFinanceReport = {
  month: string;
  summary: Omit<AdminFinancePartner, "partnerId" | "businessName">;
  partners: AdminFinancePartner[];
};

/** USERS: accounts the admin picked one by one (their ids are in metadata.targetUserIds). */
export type NotificationTargetType = "ALL" | "ROLE" | "USER" | "PARTNER" | "USERS";

/** One branch of the notification recipient picker: a role, a partner (owner and staff) or a court (its customers). */
export type NotificationRecipientGroup = {
  id: string;
  name: string;
  /** A court's partner. */
  detail: string | null;
  members: Array<{ id: string; fullName: string; email: string; role: Role }>;
};

export type AdminNotificationCampaign = {
  id: string;
  title: string;
  content: string;
  type: string;
  targetType: NotificationTargetType;
  targetRole?: Role | null;
  targetUserId?: string | null;
  targetPartnerId?: string | null;
  targetUserEmail?: string | null;
  targetUserName?: string | null;
  targetPartnerName?: string | null;
  recipientCount: number;
  /** Counted over every recipient. */
  readCount: number;
  /** Detail only. */
  unreadCount?: number;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  sender?: { id: string; fullName: string; email: string } | null;
  /** Recalled: its notifications were removed from every inbox. */
  recalledAt?: string | null;
  recallReason?: string | null;
  recalledByName?: string | null;
};

/** One recipient of a campaign, with whether and when they read it (readAt is null for reads before it was kept). */
export type AdminCampaignRecipient = {
  id: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  user: { id: string; fullName: string; email: string; role: Role };
};

type RevenueTotals = { grossAmount: number; commissionAmount: number; netAmount: number; count: number };

/**
 * One month of play from the settlement ledger (the wallet's): settled money is revenue, money waiting for its
 * booking to finish is apart, cancelled settlements are left out.
 */
export type PartnerRevenueReport = {
  month: string;
  settled: RevenueTotals;
  pending: RevenueTotals;
  items: Array<{
    id: string;
    bookingId: string;
    status: "PENDING" | "PROCESSING" | "SETTLED";
    /** PLATFORM: paid online through the app; PARTNER: collected at the counter (commission is taken from the wallet). */
    collectedBy: "PLATFORM" | "PARTNER";
    booking: { id: string; bookingCode: string; bookingDate: string; bookingStatus: string; court: { id: string; name: string } };
    grossAmount: number;
    commissionRate: number;
    commissionAmount: number;
    netAmount: number;
    settledAt: string | null;
    createdAt: string;
  }>;
};

export type Paginated<T> = {
  items: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type Voucher = {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  maxDiscountAmount?: number | null;
  minBookingAmount: number;
  usageLimit?: number | null;
  usedCount: number;
  clickCount?: number;
  startDate: string;
  endDate: string;
  status: string;
  partner: { id: string; businessName: string } | null;
  court?: { id: string; name: string; city: string; district: string; imageUrl?: string | null } | null;
  courtId?: string | null;
  fundedBy?: "PARTNER" | "PLATFORM" | "SHARED";
  partnerFundingPercent?: number | null;
  platformFundingPercent?: number | null;
  applicableDays?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  holidayOnly?: boolean;
  holidayDates?: string[] | null;
  applicableStartDate?: string | null;
  applicableEndDate?: string | null;
};

export type VoucherEligibilityReasonCode =
  | "VOUCHER_NOT_FOUND"
  | "VOUCHER_INACTIVE"
  | "VOUCHER_NOT_STARTED"
  | "VOUCHER_EXPIRED"
  | "VOUCHER_USAGE_LIMIT_REACHED"
  | "VOUCHER_MIN_BOOKING_AMOUNT"
  | "VOUCHER_APPLICABLE_START_DATE"
  | "VOUCHER_APPLICABLE_END_DATE"
  | "VOUCHER_WRONG_DAY"
  | "VOUCHER_WRONG_TIME"
  | "VOUCHER_NOT_HOLIDAY"
  | "VOUCHER_WRONG_COURT"
  | "VOUCHER_ALREADY_USED";

export type VoucherEligibilityResult = {
  voucher: Voucher;
  eligible: boolean;
  reason: { code: VoucherEligibilityReasonCode; message: string } | null;
  discountAmount: number;
  finalAmount: number;
  priorityScore: number;
};

export type VoucherEligibilityResponse = {
  bestVoucher: VoucherEligibilityResult | null;
  availableVouchers: VoucherEligibilityResult[];
  unavailableVouchers: VoucherEligibilityResult[];
};

export type PartnerVoucher = Omit<Voucher, "partner"> & {
  /** An admin disabled it; the partner cannot turn it back on. */
  lockedByAdmin?: boolean;
  /** The reason the admin gave, while the voucher is locked. */
  lockReason?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MyVoucher = Voucher & {
  userVoucherId: string;
  status: UserVoucherStatus;
  voucherStatus?: string;
  claimedAt: string;
  usedAt?: string | null;
};

export type UserVoucherStatus = "CLAIMED" | "USED" | "EXPIRED";

export type DynamicPrice = {
  courtId: string;
  basePrice: number;
  adjustments: Array<{ ruleName: string; type: "PERCENTAGE" | "FIXED_AMOUNT"; value: number; amount: number }>;
  dynamicAdjustmentAmount: number;
  finalPrice: number;
  currency: "VND";
};

export type DemandPrediction = {
  courtId: string;
  predictedDemandScore: number | null;
  predictedOccupancyRate: number | null;
  predictionLevel: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH" | null;
  confidenceScore: number;
  status: "GENERATED" | "INSUFFICIENT_DATA" | "FAILED";
  message?: { vi: string; en: string };
};

export type PartnerDemandPeakHour = {
  courtId: string;
  courtName: string;
  hour: number;
  bookingCount: number;
};

export type PartnerDemandOverview = {
  peakHours: PartnerDemandPeakHour[];
};

export type PartnerDemandCourtOverview = {
  courtId: string;
  totalHistoricalBookings: number;
  status: "READY" | "INSUFFICIENT_DATA";
  ruleBasedMinHistory: number;
  mlMinHistory: number;
  mlReady: boolean;
};

export type DemandPredictionModelVersion = "rule-based-v1" | "ml-random-forest-v1";

export type PartnerDemandForecastSlot = {
  startTime: string;
  endTime: string;
  status: "GENERATED" | "INSUFFICIENT_DATA" | "FAILED";
  predictionLevel: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH" | null;
  predictedDemandScore: number | null;
  predictedOccupancyRate: number | null;
  confidenceScore: number;
  modelVersion: DemandPredictionModelVersion | null;
};

export type PartnerDemandForecast = {
  courtId: string;
  date: string;
  totalHistoricalBookings: number;
  ruleBasedMinHistory: number;
  mlMinHistory: number;
  mlConfigured: boolean;
  slots: PartnerDemandForecastSlot[];
};

export type DynamicPricingRuleType = "PEAK_HOUR" | "OFF_PEAK_HOUR" | "WEEKEND" | "HOLIDAY" | "HIGH_DEMAND" | "LOW_DEMAND" | "CUSTOM";

export type DynamicPricingRule = {
  id: string;
  partnerId: string;
  courtId: string;
  name: string;
  description?: string | null;
  ruleType: DynamicPricingRuleType;
  dayType?: "WEEKDAY" | "WEEKEND" | "HOLIDAY" | null;
  startTime?: string | null;
  endTime?: string | null;
  priceAdjustmentType: "PERCENTAGE" | "FIXED_AMOUNT";
  priceAdjustmentValue: number | string;
  minPrice?: number | string | null;
  maxPrice?: number | string | null;
  priority: number;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
  court?: { id: string; name: string } | null;
};

/** Null clears an optional field (every day, all day, no limit). A negative value lowers the price. */
export type DynamicPricingRuleInput = {
  courtId: string;
  name: string;
  description?: string | null;
  ruleType: DynamicPricingRuleType;
  dayType?: "WEEKDAY" | "WEEKEND" | "HOLIDAY" | null;
  startTime?: string | null;
  endTime?: string | null;
  priceAdjustmentType: "PERCENTAGE" | "FIXED_AMOUNT";
  priceAdjustmentValue: number;
  minPrice?: number | null;
  maxPrice?: number | null;
  priority?: number;
  status?: "ACTIVE" | "INACTIVE";
};

export type VoucherValidatePayload = {
  voucherId?: string;
  code?: string;
  courtId: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  services?: Array<{ serviceId: string; quantity: number }>;
};

export type VoucherValidateResult = {
  voucher: {
    id: string;
    code: string;
    title: string;
    description?: string | null;
    discountType: "PERCENTAGE" | "FIXED_AMOUNT";
    discountValue: number;
    maxDiscountAmount?: number | null;
    minBookingAmount: number;
    endDate: string;
    usageLimit?: number | null;
    usedCount: number;
  };
  courtSubtotal: number;
  servicesSubtotal: number;
  subtotal: number;
  discountAmount: number;
  finalTotal: number;
  message: string;
};

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  coverImageUrl?: string | null;
  status: string;
  visibility: string;
  allowComments?: boolean;
  createdAt: string;
  updatedAt?: string;
  publishedAt?: string | null;
  category?: { id: string; name: string; slug: string } | null;
  author: { id: string; fullName: string; avatarUrl?: string | null };
  viewCount?: number;
  rejectionReason?: string | null;
  /** Why an admin hid the post, while it is hidden. */
  hiddenReason?: string | null;
};

/** A public post as the admin moderation queue lists it. */
export type AdminBlog = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  coverImageUrl?: string | null;
  status: "PENDING" | "PUBLISHED" | "REJECTED" | "HIDDEN";
  allowComments: boolean;
  createdAt: string;
  /** For a waiting post: when its author last sent it. */
  updatedAt: string;
  /** Set once the post was first published; a waiting post with it is an edit of a published post. */
  publishedAt?: string | null;
  authorName: string;
  authorEmail: string;
  authorRole: "USER" | "PARTNER";
  categoryName?: string | null;
  commentCount: number;
  lastDecisionAction?: string | null;
  lastDecisionReason?: string | null;
  lastDecisionAt?: string | null;
};

export type AdminBlogComment = {
  id: string;
  content: string;
  isEdited: boolean;
  createdAt: string;
  user: { id: string; fullName: string; email: string; role: Role };
};

/** One moderation decision (publish, reject, hide...) with who made it and why. */
export type ModerationHistoryEntry = {
  id: string;
  action: string;
  reason?: string | null;
  createdAt: string;
  actor?: { id: string; fullName: string; email: string } | null;
};

export type BlogComment = {
  id: string;
  postId: string;
  content: string;
  isEdited?: boolean;
  createdAt: string;
  updatedAt: string;
  user: { id: string; fullName: string; avatarUrl?: string | null };
};

export type Tournament = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  sportType: string;
  coverImageUrl?: string | null;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  maxParticipants: number;
  currentParticipants: number;
  entryFee: number;
  prizeDescription?: string | null;
  status: string;
  partner: { id: string; businessName: string };
  court: { id: string; name: string; city: string; district: string; imageUrl?: string | null };
};

export type TeamRecruitmentPost = {
  id: string;
  title: string;
  sportType: string;
  courtName: string;
  address: string;
  currentPlayers: number;
  maxPlayers: number;
  missingPlayers: number;
  playingDate?: string | null;
  startTime: string;
  endTime: string;
  pricePerPerson: number;
  extraServices?: string | null;
  note?: string | null;
  zaloGroupLink?: string | null;
  zaloQrImage?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; fullName: string; avatarUrl?: string | null };
};

export type TeamPostMessage = {
  id: string;
  postId: string;
  content: string | null;
  messageType?: "TEXT" | "IMAGE" | "VIDEO" | "SYSTEM";
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentSize?: number | null;
  thumbnailUrl?: string | null;
  mimeType?: string | null;
  createdAt: string;
  updatedAt: string;
  sender: { id: string; fullName: string; avatarUrl?: string | null };
  reactions?: Array<{ reaction: string; userId: string; createdAt?: string }>;
};

export type TeamRecruitmentInput = {
  courtId?: string | null;
  title: string;
  sportType: string;
  courtName: string;
  address: string;
  currentPlayers: number;
  maxPlayers: number;
  playingDate?: string | null;
  startTime: string;
  endTime: string;
  pricePerPerson: number;
  extraServices?: string | null;
  note?: string | null;
  zaloGroupLink?: string | null;
  zaloQrImage?: string | null;
};

// ── Weekly Booking Schedule ────────────────────────────────────────────────

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

export type WeeklyScheduleSlot = {
  id?: string;
  courtId?: string;
  date: string;
  startTime: string;
  endTime: string;
  courtSurfaceId?: string | null;
  courtSurfaceName?: string | null;
  status: WeeklySlotStatus;
  basePrice: number;
  finalPrice: number;
  dynamicAdjustmentAmount: number;
  adjustments: DynamicPricingAdjustment[];
  ruleNames: string[];
  predictionLevel: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH" | null;
  predictionStatus: "INSUFFICIENT_DATA" | "GENERATED" | "FAILED";
  predictedOccupancyRate: number | null;
  predictionModel?: DemandPredictionModelVersion | null;
  blockReason: string | null;
  bookingCode: string | null;
  /** Staff-only fields (StaffScheduleGrid) — undefined on the customer-facing calendar. */
  bookingId?: string | null;
  bookingStatus?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  blockId?: string | null;
};

export type WeeklyScheduleDay = {
  date: string;
  weekday: number;
  slots: WeeklyScheduleSlot[];
};

export type WeeklyScheduleDynamicPrice = {
  date: string;
  startTime: string;
  endTime: string;
  basePrice: number;
  finalPrice: number;
  dynamicAdjustmentAmount: number;
  adjustments: DynamicPricingAdjustment[];
  ruleNames: string[];
};

export type WeeklyScheduleBooking = {
  id: string;
  bookingCode: string;
  date: string;
  startTime: string;
  endTime: string;
  bookingStatus: string;
  userFullName?: string | null;
};

export type WeeklyScheduleMaintenance = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string | null;
  isMaintenance: boolean;
};

export type WeeklyScheduleVoucher = {
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
  openingTime: string;
  closingTime: string;
  minPrice: number;
  imageUrl: string | null;
  category: string | null;
};

export type WeeklyScheduleResponse = {
  court: WeeklyScheduleCourt;
  weekStart: string;
  weekEnd: string;
  slotMinutes: number;
  openingTime: string;
  closingTime: string;
  days: WeeklyScheduleDay[];
  dynamicPricing: WeeklyScheduleDynamicPrice[];
  bookings: WeeklyScheduleBooking[];
  maintenance: WeeklyScheduleMaintenance[];
  availableVouchers: WeeklyScheduleVoucher[];
};

export type SettlementStatus = "PENDING" | "PROCESSING" | "SETTLED" | "FAILED" | "CANCELLED";
export type WithdrawalStatus = "PENDING" | "APPROVED" | "PROCESSING" | "REJECTED" | "FAILED" | "PAID" | "CANCELLED";

export type PartnerWallet = {
  id: string;
  partnerId: string;
  availableBalance: number;
  pendingBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
  /** Commission owed on money the partner collected itself that the wallet could not cover. */
  commissionDebt: number;
  currency: string;
  updatedAt: string;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountHolder?: string | null;
  /** Partner's own wallet only: withdrawals open 24 hours after the payout account was set or changed. */
  bankAccountChangedAt?: string | null;
  /** Partner's own wallet only. */
  commissionRate?: number;
  debtTransfer?: { bankName: string; accountNumber: string; accountHolder: string; transferContent: string; qrCodeUrl: string } | null;
  debtPayments?: CommissionDebtPayment[];
  partner?: {
    id: string;
    businessName: string;
    bankName?: string | null;
    bankAccountNumber?: string | null;
    bankAccountHolder?: string | null;
    user?: { id: string; fullName: string; email: string };
  };
};

export type Settlement = {
  collectedBy: "PLATFORM" | "PARTNER";
  id: string;
  bookingId: string;
  partnerId: string;
  paymentId?: string | null;
  grossAmount: number;
  voucherDiscount: number;
  platformDiscount: number;
  partnerDiscount: number;
  commissionRate: number;
  commissionAmount: number;
  serviceFee: number;
  netAmount: number;
  status: SettlementStatus;
  settledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  booking?: {
    id: string;
    bookingCode: string;
    bookingDate: string;
    bookingStatus: string;
    court?: { id: string; name: string };
  };
  partner?: { id: string; businessName: string };
};

export type WithdrawalRequest = {
  id: string;
  partnerId: string;
  amount: number;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  status: WithdrawalStatus;
  processedBy?: string | null;
  processedAt?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  partner?: {
    id: string;
    businessName: string;
    /** When the partner last set or changed the payout account. */
    bankAccountChangedAt?: string | null;
    user?: { id: string; fullName: string; email: string };
    /** Admin list only: decimals arrive as strings. */
    wallet?: { availableBalance: number | string; commissionDebt: number | string } | null;
  };
  processor?: { id: string; fullName: string } | null;
};

export type SettlementSummary = {
  total: { count: number; grossAmount: number; commissionAmount: number; netAmount: number };
  byStatus: Record<string, { count: number; grossAmount: number; commissionAmount: number; netAmount: number }>;
};

export type WithdrawalSummary = {
  total: { count: number; amount: number };
  byStatus: Record<string, { count: number; amount: number }>;
};

export type CommissionDebtPayment = { id: string; amount: number; note: string | null; createdAt: string };

export type WalletAdminSummary = {
  walletCount: number;
  totalAvailable: number;
  totalPending: number;
  totalEarned: number;
  totalWithdrawn: number;
  totalCommissionDebt: number;
  debtorCount: number;
};
