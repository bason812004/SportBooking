// Author-side labels; users and partners follow the same post lifecycle (see backend blog.calculations.ts).
const statusLabels: Record<string, string> = {
  DRAFT: "Bản nháp",
  PENDING: "Chờ admin duyệt",
  PUBLISHED: "Đã xuất bản",
  REJECTED: "Bị từ chối",
  HIDDEN: "Đã ẩn"
};

/** A private post skips review and is stored as PUBLISHED, but nobody else can see it. */
export function blogStatusLabel(blog: { status: string; visibility?: string }) {
  if (blog.status === "PUBLISHED" && blog.visibility === "PRIVATE") return "Đã lưu (chỉ mình bạn xem)";
  return statusLabels[blog.status] ?? blog.status;
}

/** What the author can do next, shown under the post in their list. */
export function blogStatusHint(blog: { status: string }) {
  if (blog.status === "REJECTED") return "Sửa bài theo góp ý rồi gửi duyệt lại.";
  if (blog.status === "HIDDEN") return "Bài đã bị ẩn khỏi trang blog. Sửa bài để gửi duyệt lại.";
  return null;
}
