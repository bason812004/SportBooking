export type CourtListQuery = {
  page?: string;
  limit?: string;
  q?: string;
  city?: string;
  district?: string;
  categoryId?: string;
  sort?: "newest" | "price_asc" | "price_desc";
};
