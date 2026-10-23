import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizedSurfaceCode, sportCourtName, surfaceCode, surfaceName } from "./courtSurface.js";

test("surface identifiers share one convention across creation and seeds", () => {
  assert.equal(surfaceCode(1), "S01");
  assert.equal(surfaceCode(12), "S12");
  assert.equal(surfaceCode(100), "S100");
  assert.equal(surfaceName("Cụm sân Sala", 1), "Cụm sân Sala - Sân 01");
  assert.equal(surfaceName("x".repeat(180), 100).length, 160);
});
test("old numeric codes reserve the same number as S-prefixed codes", () => {
  for (const code of ["01", "1", "S01", "s001", " S1 "]) assert.equal(normalizedSurfaceCode(code), "S01");
  assert.equal(normalizedSurfaceCode("A1"), "A1");
});
test("a multi-sport venue names each court after the venue and the sport within 180 characters", () => {
  assert.equal(sportCourtName(" Sân Hoàng Gia ", "Pickleball"), "Sân Hoàng Gia - Pickleball");
  const long = sportCourtName("x".repeat(180), "Cầu lông");
  assert.equal(long.length, 180);
  assert.ok(long.endsWith("x - Cầu lông"));
});
