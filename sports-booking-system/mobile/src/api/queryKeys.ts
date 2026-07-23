export const queryKeys = {
  courts: (filters: unknown) => ["courts", filters] as const,
  court: (id: string) => ["court", id] as const,
  courtAvailability: (id: string, date: string) => ["court-availability", id, date] as const,
  categories: ["categories"] as const,
  sportTypes: ["sport-types"] as const,
  bookings: ["bookings"] as const,
  booking: (id: string) => ["booking", id] as const,
  vouchers: ["vouchers"] as const,
  voucher: (id: string) => ["voucher", id] as const,
  myVouchers: ["my-vouchers"] as const,
  blogs: (filters: unknown) => ["blogs", filters] as const,
  blog: (slug: string) => ["blog", slug] as const,
  tournaments: ["tournaments"] as const,
  tournament: (slug: string) => ["tournament", slug] as const,
  profile: ["profile"] as const,
  notifications: ["notifications"] as const
};

