import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { savedBlogStatus } from "./blog.calculations.js";

// In-memory posts behind a mocked repository, so the service rules are tested without SQL.
type Post = { id: string; authorId: string; slug: string; status: string; visibility: string; title: string };
let posts: Post[] = [];
const writes: any[] = [];
mock.module("./blog.repository.js", { namedExports: { blogRepository: {
  findMineById: async (id: string, userId: string) => posts.filter((post) => post.id === id && post.authorId === userId),
  createMine: async (userId: string, input: any, status: string) => {
    const post = { id: `b${posts.length + 1}`, authorId: userId, ...input, status };
    posts.push(post);
    return [post];
  },
  updateMine: async (id: string, userId: string, input: any, status: string) => {
    writes.push({ id, input, status });
    const post = posts.find((item) => item.id === id && item.authorId === userId)!;
    Object.assign(post, input, { status });
    return [post];
  },
  setMineStatus: async (id: string, userId: string, from: string, to: string) => {
    const post = posts.find((item) => item.id === id && item.authorId === userId && item.status === from);
    if (post) post.status = to;
    return post ? 1 : 0;
  },
  deleteMine: async (id: string, userId: string) => {
    const before = posts.length;
    posts = posts.filter((post) => !(post.id === id && post.authorId === userId));
    return before - posts.length;
  }
} } });
let commentPost = { id: "b1", authorId: "author", allowComments: true };
let comment = { id: "c1", postId: "b1", user: { id: "commenter" } };
const deleted: string[] = [];
mock.module("./blogComment.repository.js", { namedExports: { blogCommentRepository: {
  publishedPostBySlug: async () => [commentPost],
  findById: async () => [comment],
  delete: async (id: string) => deleted.push(id),
  update: async (id: string, content: string) => [{ id, content }]
} } });
const { blogService } = await import("./blog.service.js");
const { blogCommentService } = await import("./blogComment.service.js");

const body = { title: "Kinh nghiệm chọn vợt", content: "Nội dung đủ dài để qua kiểm tra độ dài.", visibility: "PUBLIC" as const };
const userSave = { submit: true };
const partnerSave = { submit: false };

describe("blog status rule (same for every author)", () => {
  it("drafts stay drafts until submitted; any other save goes back to review; private posts skip review", () => {
    assert.equal(savedBlogStatus(null, "PUBLIC", false), "DRAFT");
    assert.equal(savedBlogStatus("DRAFT", "PUBLIC", false), "DRAFT");
    assert.equal(savedBlogStatus(null, "PUBLIC", true), "PENDING");
    for (const current of ["PENDING", "PUBLISHED", "REJECTED", "HIDDEN"] as const) {
      assert.equal(savedBlogStatus(current, "PUBLIC", false), "PENDING", current);
    }
    assert.equal(savedBlogStatus(null, "PRIVATE", true), "PUBLISHED");
    assert.equal(savedBlogStatus("DRAFT", "PRIVATE", false), "DRAFT");
  });
});

describe("blog lifecycle", () => {
  it("users submit on save, partners keep a draft first", async () => {
    posts = [];
    assert.equal((await blogService.createMine("user", body, userSave)).status, "PENDING");
    assert.equal((await blogService.createMine("partner", body, partnerSave)).status, "DRAFT");
  });

  it("a rejected post can be edited (back to review) or resubmitted as it is — it is never stuck", async () => {
    posts = [{ id: "b1", authorId: "partner", slug: "bai-cu-abc123", status: "REJECTED", visibility: "PUBLIC", title: "Cũ" }];
    assert.equal((await blogService.updateMine("b1", "partner", body, partnerSave)).status, "PENDING");

    posts[0].status = "REJECTED";
    assert.equal((await blogService.submitMine("b1", "partner")).status, "PENDING");
    await assert.rejects(blogService.submitMine("b1", "partner"), ValidationError);
  });

  it("editing keeps the slug, so shared links keep working", async () => {
    posts = [{ id: "b1", authorId: "user", slug: "bai-cu-abc123", status: "PUBLISHED", visibility: "PUBLIC", title: "Cũ" }];
    writes.length = 0;
    await blogService.updateMine("b1", "user", { ...body, title: "Tiêu đề mới hoàn toàn" }, userSave);
    assert.equal("slug" in writes[0].input, false);
    assert.equal(posts[0].slug, "bai-cu-abc123");
  });

  it("authors delete their own posts in any status, never someone else's", async () => {
    posts = [{ id: "b1", authorId: "partner", slug: "s", status: "PUBLISHED", visibility: "PUBLIC", title: "t" }];
    await assert.rejects(blogService.deleteMine("b1", "someone-else"), NotFoundError);
    assert.deepEqual(await blogService.deleteMine("b1", "partner"), { deleted: true });
  });
});

describe("blog comment moderation", () => {
  it("the commenter, the post's author and admins may delete; others get 403", async () => {
    commentPost = { id: "b1", authorId: "author", allowComments: true };
    comment = { id: "c1", postId: "b1", user: { id: "commenter" } };
    deleted.length = 0;
    await blogCommentService.delete("slug", "c1", "author", "USER");
    await blogCommentService.delete("slug", "c1", "commenter", "USER");
    await blogCommentService.delete("slug", "c1", "admin", "ADMIN");
    assert.deepEqual(deleted, ["c1", "c1", "c1"]);
    await assert.rejects(blogCommentService.delete("slug", "c1", "stranger", "USER"), ForbiddenError);
    // The post's author moderates comments; rewording someone else's comment stays the commenter's.
    await assert.rejects(blogCommentService.update("slug", "c1", "author", "USER", "sửa"), ForbiddenError);
  });

  it("a comment from another post is not reachable through this post", async () => {
    comment = { id: "c9", postId: "other-post", user: { id: "commenter" } };
    await assert.rejects(blogCommentService.delete("slug", "c9", "author", "USER"), NotFoundError);
  });
});
