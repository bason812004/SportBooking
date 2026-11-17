import assert from "node:assert/strict";
import { test } from "node:test";
import { clearPasswordFailures, passwordRetryAfter, recordPasswordFailure, PASSWORD_FAILURE_WINDOW_MS } from "./passwordAttempts.js";

test("five wrong answers in 15 minutes make the account wait until the oldest one ages out", () => {
  const start = 1_000_000;
  assert.equal(passwordRetryAfter("u1", start), 0);
  for (let i = 0; i < 4; i += 1) recordPasswordFailure("u1", start + i * 60_000);
  assert.equal(passwordRetryAfter("u1", start + 5 * 60_000), 0, "four wrong answers still allow a try");
  assert.equal(recordPasswordFailure("u1", start + 5 * 60_000), 0);
  assert.equal(passwordRetryAfter("u1", start + 6 * 60_000), PASSWORD_FAILURE_WINDOW_MS - 6 * 60_000);
  assert.equal(passwordRetryAfter("u1", start + PASSWORD_FAILURE_WINDOW_MS), 0, "the first failure has aged out");
  clearPasswordFailures("u1");
});

test("a right answer clears the count, and accounts are counted apart", () => {
  for (let i = 0; i < 5; i += 1) recordPasswordFailure("u2", 2_000_000);
  assert.ok(passwordRetryAfter("u2", 2_000_001) > 0);
  assert.equal(passwordRetryAfter("u3", 2_000_001), 0);
  clearPasswordFailures("u2");
  assert.equal(passwordRetryAfter("u2", 2_000_001), 0);
});
