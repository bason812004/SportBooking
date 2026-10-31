export function slugify(input: string) {
  return input
    // "đ" has no combining-mark decomposition, so NFD alone would drop it ("Bóng đá" -> "bong-a").
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function uniqueSlug(name: string) {
  return `${slugify(name)}-${Date.now().toString(36)}`;
}
