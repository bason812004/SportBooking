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

export type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  status: "ACTIVE" | "INACTIVE";
};

export type Court = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  address: string;
  city: string;
  district: string;
  ward?: string;
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
  minPrice?: number;
  distanceKm?: number | null;
  averageRating?: number;
  reviewCount?: number;
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
  reviews?: Array<{ id: string; rating: number; comment?: string | null; createdAt: string; updatedAt?: string; user: { id: string; fullName: string; avatarUrl?: string | null } }>;
  ratingBreakdown?: Array<{ rating: number; count: number; percent: number }>;
  nearbyCourts?: Court[];
};

export type BookingService = {
  id: string;
  serviceId: string;
  quantity: number;
  price: string;
  service: {
    id: string;
    name: string;
    description?: string | null;
    price: string;
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

export type Booking = {
  id: string;
  bookingCode: string;
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
  taxCode?: string | null;
  user: { fullName: string; email: string; phone?: string; avatarUrl?: string };
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
  bookings: number;
  pendingCourts: number;
  pendingPartners: number;
  financials: { gmv: number; refunds: number; platformCommission: number; partnerPayout: number };
  trend: Array<{ date: string; bookings: number; gmv: number }>;
  pendingItems: Court[];
};

export type AdminPartner = PartnerProfile & {
  commissionRate?: string | null;
  courts?: Array<{ id: string; name: string; approvalStatus: string; activeStatus: string }>;
  history?: Array<{ id: string; action: string; reason?: string; createdAt: string }>;
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
  bookingServices?: Array<{ id: string; quantity: number; price: number; service: { id: string; name: string; price: number } }>;
  adminActions?: BookingAdminAction[];
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

export type AdminVoucher = {
  id: string; code: string; title: string; discountType: string; discountValue: number;
  minBookingAmount: number;
  usedCount: number; usageLimit?: number | null; startDate: string; endDate: string;
  status: string; businessName: string | null; courtName?: string | null; createdAt: string;
};

export type AdminVoucherInput = {
  code: string;
  title: string;
  description?: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  maxDiscountAmount?: number | null;
  minBookingAmount: number;
  usageLimit?: number | null;
  startDate: string;
  endDate: string;
};

export type AuditLog = {
  id: string; action: string; entityType: string; entityId: string;
  previousHash?: string | null; currentHash: string; createdAt: string;
  actor: { fullName: string; email: string; role: string };
};

export type BlockchainLog = {
  id: string; entityType: string; entityId: string; payloadHash: string;
  network: string; txHash?: string | null; status: string; error?: string | null;
  attempts: number; confirmedAt?: string | null; createdAt: string;
};

export type CommissionRateConfig = {
  partnerId: string;
  businessName: string;
  overrideRate: number | null;
  defaultRate: number;
  effectiveRate: number;
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
  transactionType: "EARNING" | "REVERSAL";
  eventType: "COMPLETED" | "NO_SHOW" | "REFUND";
  grossAmount: number;
  commissionRate: number;
  commissionAmount: number;
  netAmount: number;
  payoutStatus: string;
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
  payoutId?: string | null;
  payoutStatus: "PENDING" | "PROCESSING" | "PAID" | "FAILED" | "CANCELLED";
  payoutNote?: string | null;
  paidAt?: string | null;
  payoutUpdatedAt?: string | null;
};

export type AdminFinanceReport = {
  month: string;
  summary: CommissionSummary & {
    refundAmount: number;
    platformRetainedAmount: number;
    refundCount: number;
  };
  partners: AdminFinancePartner[];
};

export type NotificationTargetType = "ALL" | "ROLE" | "USER" | "PARTNER";

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
  targetPartnerName?: string | null;
  recipientCount: number;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  sender?: { id: string; fullName: string; email: string } | null;
  recipients?: Array<{
    id: string;
    isRead: boolean;
    createdAt: string;
    user: { id: string; fullName: string; email: string; role: Role };
  }>;
};

export type PartnerRevenueReport = {
  month: string;
  summary: CommissionSummary;
  items: Array<{
    id: string;
    bookingId: string;
    bookingCode: string;
    bookingDate: string;
    court: { id: string; name: string };
    eventType: "COMPLETED" | "NO_SHOW";
    transactionType: "EARNING" | "REVERSAL";
    grossAmount: number;
    commissionRate: number;
    commissionAmount: number;
    netAmount: number;
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
  | "VOUCHER_WRONG_COURT";

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

export type DynamicPricingRuleInput = {
  courtId: string;
  name: string;
  description?: string;
  ruleType: DynamicPricingRuleType;
  dayType?: "WEEKDAY" | "WEEKEND" | "HOLIDAY";
  startTime?: string;
  endTime?: string;
  priceAdjustmentType: "PERCENTAGE" | "FIXED_AMOUNT";
  priceAdjustmentValue: number;
  minPrice?: number;
  maxPrice?: number;
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
export type WithdrawalStatus = "PENDING" | "APPROVED" | "PROCESSING" | "REJECTED" | "FAILED" | "PAID";

export type PartnerWallet = {
  id: string;
  partnerId: string;
  availableBalance: number;
  pendingBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
  currency: string;
  updatedAt: string;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountHolder?: string | null;
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
    user?: { id: string; fullName: string; email: string };
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

export type WalletAdminSummary = {
  walletCount: number;
  totalAvailable: number;
  totalPending: number;
  totalEarned: number;
  totalWithdrawn: number;
};
