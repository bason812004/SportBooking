import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

type Image = { id: string; courtId: string; imageUrl: string; publicId: string | null; sortOrder: number };
type Request = { id: string; courtId: string; imageUrl: string; publicId: string | null; replaceImageId?: string; previousImageUrl?: string; status: string };
let images: Image[];
let requests: Request[];
let uploads = 0;
const court = { id: "court1", approvalStatus: "APPROVED", activeStatus: "ACTIVE" };
const db: any = {
  $queryRaw: async () => [{ id: court.id }],
  $transaction: async (fn: (tx: any) => Promise<unknown>) => {
    const snapshot = structuredClone({ images, requests });
    try { return await fn(db); } catch (error) { images = snapshot.images; requests = snapshot.requests; throw error; }
  },
  court: { findFirst: async ({ where }: any) => where.id === court.id && where.partner.userId === "owner" ? court : null },
  courtImage: {
    findUnique: async ({ where }: any) => images.find((image) => image.id === where.id) ?? null,
    delete: async ({ where }: any) => {
      const image = images.find((item) => item.id === where.id);
      images = images.filter((item) => item.id !== where.id);
      return image;
    },
    findFirst: async ({ where }: any) => images.find((image) => image.id === where.id && image.courtId === where.courtId) ?? null,
    aggregate: async () => ({ _max: { sortOrder: images.length ? Math.max(...images.map((image) => image.sortOrder)) : null } }),
    create: async ({ data }: any) => { const image = { id: "new-image", ...data }; images.push(image); return image; },
    updateMany: async ({ where, data }: any) => {
      const image = images.find((item) => item.id === where.id && item.courtId === where.courtId && item.imageUrl === where.imageUrl);
      if (!image) return { count: 0 };
      Object.assign(image, data);
      return { count: 1 };
    }
  },
  courtImageRequest: {
    findFirst: async ({ where }: any) => requests.find((request) =>
      (typeof where.replaceImageId === "object" ? Boolean(request.replaceImageId) : request.replaceImageId === where.replaceImageId)
      && (!where.courtId || request.courtId === where.courtId) && request.status === where.status) ?? null,
    findUnique: async ({ where }: any) => requests.find((request) => request.id === where.id) ?? null,
    create: async ({ data }: any) => { const request = { id: `request${requests.length + 1}`, status: "PENDING", publicId: null, ...data }; requests.push(request); return request; },
    updateMany: async ({ where, data }: any) => {
      if (where.court && where.court.partner.userId !== "owner") return { count: 0 };
      const request = requests.find((item) => item.id === where.id && item.status === where.status);
      if (!request) return { count: 0 };
      Object.assign(request, data);
      return { count: 1 };
    }
  }
};
mock.module("../../config/db.js", { namedExports: { prisma: db } });
mock.module("../../shared/services/cloudinary.service.js", { namedExports: { cloudinaryService: {
  uploadCourtImage: async () => { uploads++; return { imageUrl: "https://example.com/new.jpg", publicId: "new" }; },
  deleteImage: async () => undefined
} } });
const { courtImageService } = await import("./courtImage.service.js");
const { partnerRepository } = await import("../partner/partner.repository.js");
const { imageReviewSchema } = await import("./courtImage.validation.js");

beforeEach(() => {
  images = [{ id: "cover", courtId: court.id, imageUrl: "https://example.com/old.jpg", publicId: "old", sortOrder: 0 }];
  requests = [];
  uploads = 0;
});

const submit = (replaceImageId?: string) => courtImageService.submit("owner", court.id, { imageUrl: "https://example.com/new.jpg", replaceImageId });

test("replacement stays private and preserves the only cover and court availability while pending", async () => {
  const old = structuredClone(images);
  const request = await submit("cover");
  assert.equal(request.status, "PENDING");
  assert.deepEqual(images, old);
  assert.equal(court.approvalStatus, "APPROVED");
  assert.equal(court.activeStatus, "ACTIVE");
});

test("approval swaps the cover URL atomically and keeps its ID and order", async () => {
  const request = await submit("cover");
  await courtImageService.review("admin", request.id, "APPROVED");
  assert.equal(images.length, 1);
  assert.equal(images[0].id, "cover");
  assert.equal(images[0].sortOrder, 0);
  assert.equal(images[0].imageUrl, "https://example.com/new.jpg");
  assert.equal(request.status, "APPROVED");
});

test("rejection keeps the existing published cover", async () => {
  const old = structuredClone(images);
  const request = await submit("cover");
  await courtImageService.review("admin", request.id, "REJECTED", "Ảnh không rõ");
  assert.deepEqual(images, old);
  assert.equal(request.status, "REJECTED");
});

test("a court with no images stays empty until its first image is approved", async () => {
  images = [];
  const request = await submit();
  assert.equal(images.length, 0);
  await courtImageService.review("admin", request.id, "APPROVED");
  assert.equal(images[0].sortOrder, 0);
  assert.equal(court.approvalStatus, "APPROVED");
});

test("additional images append without replacing the cover", async () => {
  const request = await submit();
  await courtImageService.review("admin", request.id, "APPROVED");
  assert.equal(images[0].imageUrl, "https://example.com/old.jpg");
  assert.equal(images[1].sortOrder, 1);
});

test("approval cannot run twice or approve a cancelled request", async () => {
  const first = await submit();
  await courtImageService.review("admin", first.id, "APPROVED");
  await assert.rejects(courtImageService.review("admin", first.id, "APPROVED"), { statusCode: 409 });
  const second = await submit("cover");
  await courtImageService.cancel("owner", second.id);
  await assert.rejects(courtImageService.review("admin", second.id, "APPROVED"), { statusCode: 409 });
  assert.equal(images.length, 2);
});

test("missing original image rolls back the approval decision", async () => {
  const request = await submit("cover");
  images = [];
  await assert.rejects(courtImageService.review("admin", request.id, "APPROVED"), { statusCode: 409 });
  assert.equal(requests[0].status, "PENDING");
  assert.equal(images.length, 0);
});

test("duplicate replacement and an image from a different court are rejected", async () => {
  await submit("cover");
  await assert.rejects(submit("cover"), { statusCode: 409 });
  await assert.rejects(submit("other-court-image"), { statusCode: 404 });
  assert.equal(requests.length, 1);
});

test("non-owner cannot upload or cancel another owner's image request", async () => {
  await assert.rejects(courtImageService.submit("stranger", court.id, {}, {} as Express.Multer.File), { statusCode: 404 });
  assert.equal(uploads, 0);
  const request = await submit("cover");
  await assert.rejects(courtImageService.cancel("stranger", request.id), { statusCode: 409 });
  assert.equal(request.status, "PENDING");
});

test("review validation requires a rejection reason and a valid decision", () => {
  const params = { id: "123e4567-e89b-42d3-a456-426614174000" };
  assert.equal(imageReviewSchema.safeParse({ params, body: { decision: "REJECTED", reason: " " } }).success, false);
  assert.equal(imageReviewSchema.safeParse({ params, body: { decision: "APPROVED" } }).success, true);
  assert.equal(imageReviewSchema.safeParse({ params, body: { decision: "CANCELLED" } }).success, false);
});

test("pending replacement blocks deleting the original and reordering; cancellation permits deletion", async () => {
  const request = await submit("cover");
  await assert.rejects(partnerRepository.deleteImage("cover"), { statusCode: 409 });
  await assert.rejects(partnerRepository.reorderImages(court.id, ["cover"]), { statusCode: 409 });
  assert.equal(images.length, 1);
  await courtImageService.cancel("owner", request.id);
  await partnerRepository.deleteImage("cover");
  assert.equal(images.length, 0);
});
