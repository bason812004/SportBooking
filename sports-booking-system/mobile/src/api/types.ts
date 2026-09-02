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
  surfaces?: Array<{ id: string; name: string; code?: string; surface?: string; capacity?: string; imageUrl?: string | null; sortOrder?: number }>;
  prices: Array<{ id: string; dayType: string; startTime: string; endTime: string; price: string | number; note?: string | null }>;
  services: Array<{ id: string; name: string; description?: string | null; price: string | number; status: string; unit?: string }>;
  reviews?: Array<{ id: string; rating: number; comment?: string | null; createdAt: string; user: { id: string; fullName: string; avatarUrl?: string | null } }>;
  ratingBreakdown?: Array<{ rating: number; count: number; percent: number }>;
  nearbyCourts?: Court[];
};

export type AvailabilitySlot = {
  startTime: string;
  endTime: string;
  status: "AVAILABLE" | "BOOKED" | "PENDING_PAYMENT" | "BLOCKED" | "MAINTENANCE" | "CLOSED";
  price: number;
  finalPrice?: number;
  courtSurfaceId?: string | null;
  courtSurfaceName?: string | null;
  bookingId: string | null;
};

export type BookingService = {
  id: string;
  serviceId: string;
  quantity: number;
  price: string | number;
  service: { id: string; name: string; description?: string | null; price: string | number };
};

export type BookingSlotItem = {
  id?: string;
  bookingDate?: string;
  startTime: string;
  endTime: string;
  slotPrice?: number | string;
  court_surfaces?: { id: string; name: string };
};

export type Booking = {
  id: string;
  bookingCode: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  createdAt: string;
  totalPrice: string | number;
  subtotal?: string | number;
  voucherDiscountAmount?: string | number;
  paymentMethod: string;
  paymentStatus: string;
  bookingStatus: string;
  cancelReason?: string | null;
  note?: string | null;
  cancelledAt?: string | null;
  depositAmount?: string | null;
  refundAmount?: string | null;
  court: Court;
  bookingSlots?: BookingSlotItem[];
  bookingServices?: BookingService[];
  bookingVoucher?: {
    discountAmount: string | number;
    voucher: { id: string; code: string; title: string; discountType: "PERCENTAGE" | "FIXED_AMOUNT"; discountValue: number };
  } | null;
  payments?: Array<{ id: string; status: string; amount: string | number; paymentMethod: string; paymentType: string; expiresAt?: string | null; createdAt: string }>;
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

export type BlogComment = {
  id: string;
  content: string;
  createdAt: string;
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
  partner?: { id: string; businessName: string };
  court?: { id: string; name: string; city: string; district: string; imageUrl?: string | null };
};

export type TeamRecruitmentPost = {
  id: string;
  title: string;
  sportType: string;
  courtName: string;
  address: string;
  currentPlayers: number;
  maxPlayers: number;
  missingPlayers?: number;
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
  updatedAt?: string;
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
  updatedAt?: string;
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

export type GroupMember = {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  role: string;
  status: string;
  joinedAt: string;
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
