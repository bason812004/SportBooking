export type BlogStatus = "DRAFT" | "PENDING" | "PUBLISHED" | "REJECTED" | "HIDDEN";
export type BlogVisibility = "PUBLIC" | "PRIVATE";

/**
 * Status a post gets when its author saves it — one rule for every author (user or partner):
 *  - a draft stays a draft until it is submitted;
 *  - any other save goes (back) to admin review, so edits to published, rejected or hidden posts are
 *    re-moderated before the public sees them;
 *  - a private post is only ever shown to its author, so it skips review and is kept as published.
 */
export function savedBlogStatus(current: BlogStatus | null, visibility: BlogVisibility, submit: boolean): BlogStatus {
  if (!submit && (current === null || current === "DRAFT")) return "DRAFT";
  return visibility === "PRIVATE" ? "PUBLISHED" : "PENDING";
}

/** Posts an author can send (back) for review without editing them first. */
export const submittableBlogStatuses: BlogStatus[] = ["DRAFT", "REJECTED"];
