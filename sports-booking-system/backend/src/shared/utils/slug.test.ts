import assert from "node:assert/strict";
import { test } from "node:test";
import { slugify, uniqueSlug } from "./slug.js";

test("slugify keeps the d of Vietnamese đ/Đ instead of dropping it", () => {
  assert.equal(slugify("Bóng đá mini"), "bong-da-mini");
  assert.equal(slugify("Đua xe đạp"), "dua-xe-dap");
  assert.equal(slugify("Cầu lông"), "cau-long");
  assert.equal(slugify("  Sân 5 người / Quận 7  "), "san-5-nguoi-quan-7");
});

test("uniqueSlug starts with the readable slug", () => {
  assert.match(uniqueSlug("Giải đấu mùa hè"), /^giai-dau-mua-he-[a-z0-9]+$/);
});
