export type Role = "USER" | "PARTNER" | "ADMIN";

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
  priceNote?: string;
  goldenPriceNote?: string;
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
  surfaces?: Array<{ id: string; code: string; name: string; capacity?: string; surface?: string; size?: string; imageUrl?: string; sortOrder: number }>;
  amenities: Array<{ id: string; name: string }>;
  prices: Array<{ id: string; dayType: string; startTime: string; endTime: string; price: string; note?: string }>;
  services: Array<{ id: string; name: string; description?: string; price: string; status: string }>;
  reviews?: Array<{ id: string; rating: number; comment?: string; createdAt: string; user: { id: string; fullName: string; avatarUrl?: string } }>;
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
  user?: { id?: string; fullName: string; email?: string; phone?: string };
  bookingServices?: BookingService[];
  bookingVoucher?: BookingVoucherInfo | null;
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
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
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

export type AdminVoucher = {
  id: string; code: string; title: string; discountType: string; discountValue: number;
  usedCount: number; usageLimit?: number | null; startDate: string; endDate: string;
  status: string; businessName: string; courtName?: string | null;
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
  partner: { id: string; businessName: string };
  court?: { id: string; name: string; city: string; district: string; imageUrl?: string | null } | null;
};

export type PartnerVoucher = Omit<Voucher, "partner"> & {
  createdAt: string;
  updatedAt: string;
};

export type MyVoucher = Voucher & {
  userVoucherId: string;
  status: UserVoucherStatus;
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
  createdAt: string;
  publishedAt?: string | null;
  category?: { id: string; name: string; slug: string } | null;
  author: { id: string; fullName: string; avatarUrl?: string | null };
  viewCount?: number;
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

export type TeamRecruitmentInput = {
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
