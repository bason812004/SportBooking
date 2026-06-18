import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { comparePassword, generateAccessToken, hashPassword, verifyAccessToken } from "./auth.security.js";

describe("auth security", () => {
  it("hashes and compares passwords", async () => {
    const hash = await hashPassword("password123");
    assert.notEqual(hash, "password123");
    assert.equal(await comparePassword("password123", hash), true);
    assert.equal(await comparePassword("wrong-password", hash), false);
  });

  it("generates and verifies access tokens", () => {
    const token = generateAccessToken({ id: "00000000-0000-0000-0000-000000000001", role: "USER" });
    const payload = verifyAccessToken(token);
    assert.equal(payload.sub, "00000000-0000-0000-0000-000000000001");
    assert.equal(payload.role, "USER");
  });
});
