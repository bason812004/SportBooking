export type Role = "USER" | "PARTNER" | "ADMIN";

export type ApiResponse<T> = {
  success: boolean;
  data: T;
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
  averageRating?: number;
  reviewCount?: number;
  category: Category;
  images: Array<{ id: string; imageUrl: string; sortOrder: number }>;
  surfaces?: Array<{ id: string; code: string; name: string; capacity?: string; surface?: string; size?: string; imageUrl?: string; sortOrder: number }>;
  amenities: Array<{ id: string; name: string }>;
  prices: Array<{ id: string; dayType: string; startTime: string; endTime: string; price: string; note?: string }>;
  services: Array<{ id: string; name: string; description?: string; price: string; status: string }>;
  reviews?: Array<{ id: string; rating: number; comment?: string; createdAt: string; user: { id: string; fullName: string; avatarUrl?: string } }>;
  ratingBreakdown?: Array<{ rating: number; count: number; percent: number }>;
  nearbyCourts?: Court[];
};

export type Booking = {
  id: string;
  bookingCode: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  totalPrice: string;
  paymentMethod: string;
  paymentStatus: string;
  bookingStatus: string;
  court: Court;
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
  startDate: string;
  endDate: string;
  status: string;
  partner: { id: string; businessName: string };
  court?: { id: string; name: string; city: string; district: string; imageUrl?: string | null } | null;
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
