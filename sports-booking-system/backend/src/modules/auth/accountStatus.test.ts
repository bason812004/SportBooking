import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

let statuses: Record<string, string | null>;
let revokedAt: Record<string, Date | null>;
let lookups: string[];
let failNext: boolean;
mock.module("./auth.repository.js", { namedExports: { authRepository: {
  accountStatus: async (id: string) => {
    lookups.push(id);
    if (failNext) {
      failNext = false;
      throw new Error("database unavailable");
    }
    return statuses[id] ? { status: statuses[id], sessionsRevokedAt: revokedAt[id] ?? null } : null;
  }
} } });
const { forgetAccountStatus, isAccountActive, sessionRefusal } = await import("./accountStatus.js");

beforeEach(() => {
  statuses = { u1: "ACTIVE", u2: "LOCKED" };
  revokedAt = {};
  lookups = [];
  failNext = false;
  ["u1", "u2", "gone"].forEach(forgetAccountStatus);
});

test("only an ACTIVE account counts as active; a locked or deleted one does not", async () => {
  assert.equal(await isAccountActive("u1"), true);
  assert.equal(await isAccountActive("u2"), false);
  assert.equal(await isAccountActive("gone"), false);
});

test("concurrent requests share one lookup, and the answer is reused within the window", async () => {
  await Promise.all([isAccountActive("u1"), isAccountActive("u1"), isAccountActive("u1")]);
  await isAccountActive("u1");
  assert.deepEqual(lookups, ["u1"]);
});

test("forgetAccountStatus makes a lock visible at once instead of after the window", async () => {
  assert.equal(await isAccountActive("u1"), true);
  statuses.u1 = "LOCKED";
  assert.equal(await isAccountActive("u1"), true, "still the cached answer");
  forgetAccountStatus("u1");
  assert.equal(await isAccountActive("u1"), false);
});

test("a cached answer expires after 30 seconds", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  await isAccountActive("u1");
  statuses.u1 = "LOCKED";
  t.mock.timers.tick(29_000);
  assert.equal(await isAccountActive("u1"), true);
  t.mock.timers.tick(2_000);
  assert.equal(await isAccountActive("u1"), false);
});

test("tokens issued before the sessions were revoked are refused, later ones accepted", async () => {
  revokedAt.u1 = new Date("2026-10-29T10:00:00.700Z");
  const revokedSecond = Math.floor(revokedAt.u1.getTime() / 1000);
  assert.equal(await sessionRefusal("u1", revokedSecond - 60), "REVOKED");
  assert.equal(await sessionRefusal("u1", revokedSecond), null, "a login in the same second is accepted");
  assert.equal(await sessionRefusal("u1", revokedSecond + 60), null);
  assert.equal(await sessionRefusal("u2", revokedSecond + 60), "LOCKED");
  assert.equal(await sessionRefusal("gone", revokedSecond + 60), "LOCKED");
});

test("a failed lookup is not remembered", async () => {
  failNext = true;
  await assert.rejects(isAccountActive("u1"));
  assert.equal(await isAccountActive("u1"), true);
});
