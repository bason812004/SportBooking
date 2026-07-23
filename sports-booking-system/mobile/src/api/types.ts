export type Role = "USER" | "PARTNER" | "ADMIN" | "RECIPIENT";

export type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data: T;
  errors?: Record<string, string[]>;
};

export type Paginated<T> = {
  items: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type User = {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: Role;
  status: "ACTIVE" | "LOCKED";
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  status: "ACTIVE" | "INACTIVE";
};

export type Court = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  address: string;
  city: string;
  district: string;
  ward?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  activeStatus: "ACTIVE" | "INACTIVE";
  openingTime: string;
  closingTime: string;
  mapUrl?: string | null;
  contactPhone?: string | null;
  minPrice?: number | null;
  distanceKm?: number | null;
  averageRating?: number | null;
  reviewCount?: number | null;
  depositPercent?: number | null;
  category?: Category | null;
  partner?: { id: string; businessName: string; user?: { fullName: string; email: string; phone?: string | null } | null } | null;
  images: Array<{ id: string; imageUrl: string; sortOrder: number }>;
  amenities: Array<{ id: string; name: string }>;
  surfaces?: Array<{ id: string; name: string; imageUrl?: string | null; sortOrder: number }>;
  prices: Array<{ id: string; dayType: string; startTime: string; endTime: string; price: string; note?: string | null }>;
  services: Array<{ id: string; name: string; description?: string | null; price: string; status: string }>;
  reviews?: Array<{ id: string; rating: number; comment?: string | null; createdAt: string; user: { id: string; fullName: string; avatarUrl?: string | null } }>;
  ratingBreakdown?: Array<{ rating: number; count: number; percent: number }>;
  nearbyCourts?: Court[];
};

export type AvailabilitySlot = {
  startTime: string;
  endTime: string;
  status: "AVAILABLE" | "BOOKED" | "PENDING_PAYMENT" | "BLOCKED" | "MAINTENANCE" | "CLOSED";
  price: number;
  bookingId: string | null;
};

export type BookingService = {
  id: string;
  serviceId: string;
  quantity: number;
  price: string;
  service: { id: string; name: string; description?: string | null; price: string };
};

export type Booking = {
  id: string;
  bookingCode: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  createdAt: string;
  totalPrice: string;
  subtotal?: string;
  voucherDiscountAmount?: string;
  paymentMethod: string;
  paymentStatus: string;
  bookingStatus: string;
  cancelReason?: string | null;
  note?: string | null;
  cancelledAt?: string | null;
  depositAmount?: string | null;
  refundAmount?: string | null;
  court: Court;
  bookingServices?: BookingService[];
  bookingVoucher?: {
    discountAmount: string;
    voucher: { id: string; code: string; title: string; discountType: "PERCENTAGE" | "FIXED_AMOUNT"; discountValue: number };
  } | null;
  payments?: Array<{ id: string; status: string; amount: string; paymentMethod: string; paymentType: string; expiresAt?: string | null; createdAt: string }>;
  review?: { id: string; rating: number; comment?: string | null; createdAt: string } | null;
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
  startDate: string;
  endDate: string;
  status: string;
  partner?: { id: string; businessName: string } | null;
  court?: { id: string; name: string; city: string; district: string; imageUrl?: string | null } | null;
};

export type MyVoucher = Voucher & {
  userVoucherId: string;
  status: "CLAIMED" | "USED" | "EXPIRED";
  claimedAt: string;
  usedAt?: string | null;
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
  publishedAt?: string | null;
  author?: { id: string; fullName: string; avatarUrl?: string | null };
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
  partner?: { id: string; businessName: string };
  court?: { id: string; name: string; city: string; district: string; imageUrl?: string | null };
};

export type NotificationItem = {
  id: string;
  title: string;
  content: string;
  type: string;
  metadata?: unknown;
  isRead: boolean;
  createdAt: string;
};

