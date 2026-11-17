import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import { createDynamicFakePrisma } from "../../shared/testing/fakePrisma.js";

const fake = createDynamicFakePrisma();
mock.module("../../config/db.js", { namedExports: { prisma: fake.client } });
let created: Array<{ entries: any[]; deposit: number | null }>;
const categories = [
  { id: "cat-pb", name: "Pickleball", slug: "pickleball" },
  { id: "cat-bd", name: "Cầu lông", slug: "cau-long" }
];
mock.module("./partner.repository.js", { namedExports: { partnerRepository: {
  profileByUser: async () => ({ id: "p1", user: { email: "p@x.vn" } }),
  activeCategoriesByIds: async (ids: string[]) => categories.filter((category) => ids.includes(category.id)),
  createCourts: async (entries: any[], deposit: number | null) => {
    created.push({ entries, deposit });
    return entries.map((entry, index) => ({ id: `c${index + 1}`, ...entry.data }));
  }
} } });
const { partnerService } = await import("./partner.service.js");
const { courtRegistrationSchema } = await import("./partner.validation.js");

const venue = {
  name: "Sân Hoàng Gia", address: "12 Lê Lợi", ward: "Phường Bến Thành", city: "TP.HCM",
  openingTime: "06:00", closingTime: "22:00", depositPercent: 30
};
const sport = (categoryId: string, ...names: string[]) => ({ categoryId, surfaces: names.map((name) => ({ name })) });
const parse = (body: unknown) => courtRegistrationSchema.safeParse({ body });
const register = (body: unknown) => {
  const parsed = parse(body);
  assert.equal(parsed.success, true, JSON.stringify(parsed.error?.issues));
  return partnerService.registerCourts("user1", parsed.data!.body);
};

beforeEach(() => { created = []; });

describe("venue registration validation", () => {
  it("accepts 1-5 distinct sports with 1-30 sub-courts each", () => {
    assert.equal(parse({ ...venue, sports: [sport("cat-pb", "Sân 1")] }).success, true);
    assert.equal(parse({ ...venue, sports: [] }).success, false);
    assert.equal(parse({ ...venue, sports: ["a", "b", "c", "d", "e", "f"].map((id) => sport(id, "Sân 1")) }).success, false);
    assert.equal(parse({ ...venue, sports: [sport("cat-pb", "Sân 1"), sport("cat-pb", "Sân 1")] }).success, false);
    assert.equal(parse({ ...venue, sports: [sport("cat-pb")] }).success, false);
    const thirty = Array.from({ length: 30 }, (_, index) => `Sân ${index + 1}`);
    assert.equal(parse({ ...venue, sports: [sport("cat-pb", ...thirty)] }).success, true);
    assert.equal(parse({ ...venue, sports: [sport("cat-pb", ...thirty, "Sân 31")] }).success, false);
  });

  it("rejects duplicate sub-court names within a sport, ignoring case and extra spaces", () => {
    const result = parse({ ...venue, sports: [sport("cat-pb", "Sân VIP", "  sân   vip ")] });
    assert.equal(result.success, false);
    assert.deepEqual(result.error!.issues[0].path, ["body", "sports", 0, "surfaces", 1, "name"]);
    // The same name in two different sports is fine.
    assert.equal(parse({ ...venue, sports: [sport("cat-pb", "Sân 1"), sport("cat-bd", "Sân 1")] }).success, true);
    assert.equal(parse({ ...venue, sports: [sport("cat-pb", "   ")] }).success, false);
  });

  it("drops client-sent codes and turns empty optional fields into null", () => {
    const result = parse({ ...venue, sports: [{ categoryId: "cat-pb", surfaces: [{ code: "X9", name: " Sân 1 ", surface: "", size: "20x10m" }] }] });
    assert.equal(result.success, true);
    assert.deepEqual(result.data!.body.sports[0].surfaces[0], { name: "Sân 1", surface: null, size: "20x10m" });
  });
});

describe("venue registration service", () => {
  it("keeps the typed name for a single sport", async () => {
    const result = await register({ ...venue, sports: [sport("cat-pb", "Sân 1", "Sân 2")] });
    assert.equal(created.length, 1);
    const [entry] = created[0].entries;
    assert.equal(entry.data.name, "Sân Hoàng Gia");
    assert.equal(entry.data.categoryId, "cat-pb");
    assert.equal(entry.data.district, null);
    assert.equal(entry.data.ward, "Phường Bến Thành");
    assert.equal(entry.data.approvalStatus, "PENDING");
    assert.equal(entry.data.activeStatus, "ACTIVE");
    assert.deepEqual(entry.surfaces, [{ name: "Sân 1", surface: null, size: null }, { name: "Sân 2", surface: null, size: null }]);
    assert.equal(created[0].deposit, 30);
    assert.equal(result.courts.length, 1);
  });

  it("names one court per sport after the venue and gives each a distinct slug", async () => {
    await register({ ...venue, depositPercent: undefined, sports: [sport("cat-pb", "Sân 1"), sport("cat-bd", "Sân 1")] });
    const { entries, deposit } = created[0];
    assert.deepEqual(entries.map((entry) => entry.data.name), ["Sân Hoàng Gia - Pickleball", "Sân Hoàng Gia - Cầu lông"]);
    assert.equal(new Set(entries.map((entry) => entry.data.slug)).size, 2);
    assert.equal(deposit, null);
  });

  it("fits long venue names into the court name column", async () => {
    await register({ ...venue, name: "x".repeat(150), sports: [sport("cat-pb", "Sân 1"), sport("cat-bd", "Sân 1")] });
    for (const entry of created[0].entries) assert.ok(entry.data.name.length <= 180);
    assert.ok(created[0].entries[1].data.name.endsWith(" - Cầu lông"));
  });

  it("rejects an unknown or inactive sport without creating anything", async () => {
    await assert.rejects(register({ ...venue, sports: [sport("cat-pb", "Sân 1"), sport("cat-gone", "Sân 1")] }), (error: any) => {
      assert.equal(error.statusCode, 400);
      return true;
    });
    assert.equal(created.length, 0);
  });

  it("rejects closing before opening", async () => {
    await assert.rejects(register({ ...venue, openingTime: "22:00", closingTime: "06:00", sports: [sport("cat-pb", "Sân 1")] }), /Gio mo cua/);
    assert.equal(created.length, 0);
  });
});
