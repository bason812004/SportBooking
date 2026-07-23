import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";

import { WEEKLY_DEFAULT_OPEN, WEEKLY_DEFAULT_CLOSE } from "./weeklySchedule.types.js";

// ============================================================
// Regression test for the Prisma array-binding crash:
//
// `Prisma.$queryRaw`${...} can produce `WHERE id = $1` for a
// `string[]` and crash with "Value is a list but varchar is not".
// The fix uses `Prisma.join(ids)` so the array expands into a
// proper IN (...) list.
// ============================================================

test("Prisma.join expands a string[] into a comma-separated, parameterised list", () => {
  const ids = ["tmsg0001", "tmsg0002", "tmsg0003"];
  const fragment = Prisma.join(ids);
  // Each id becomes its own parameter placeholder; values stay external.
  const sql = Prisma.sql`select * from team_post_message_reactions where message_id in (${fragment})`;
  assert.ok(Array.isArray(sql.values));
  // The fragment expands to a flat list of values, exactly 3.
  assert.equal(sql.values.length, 3);
  assert.deepEqual(sql.values, ids);
});

test("Prisma.join throws when called with an empty array — callers must guard", () => {
  // The sql-template-tag library refuses empty joins, so callers MUST
  // guard with `if (ids.length === 0) return []` before calling Prisma.join.
  // listReactionsForMessages already does that guard.
  assert.throws(() => Prisma.join([]));
});

test("Weekly schedule constants remain stable", () => {
  assert.equal(WEEKLY_DEFAULT_OPEN, "05:00");
  assert.equal(WEEKLY_DEFAULT_CLOSE, "23:00");
});