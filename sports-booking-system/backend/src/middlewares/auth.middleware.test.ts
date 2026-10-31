import assert from "node:assert/strict";
import { mock, test } from "node:test";

let statusLookups: string[] = [];
mock.module("../modules/auth/auth.security.js", { namedExports: { verifyAccessToken: (token: string) => {
  if (token === "forged") throw new Error("invalid signature");
  return { sub: token, role: "PARTNER", iat: token === "old-token" ? 100 : 200 };
} } });
mock.module("../modules/auth/accountStatus.js", { namedExports: { sessionRefusal: async (id: string, issuedAt?: number) => {
  statusLookups.push(id);
  if (id === "old-token") return (issuedAt ?? 0) < 150 ? "REVOKED" : null;
  return id === "active-user" ? null : "LOCKED";
} } });
const { authMiddleware } = await import("./auth.middleware.js");

function run(authorization?: string) {
  const req: any = { headers: authorization ? { authorization } : {} };
  return new Promise<{ req: any; error: any }>((resolve) => {
    void authMiddleware(req, {} as any, (error?: unknown) => resolve({ req, error }));
  });
}

test("an active account passes with its user attached", async () => {
  const { req, error } = await run("Bearer active-user");
  assert.equal(error, undefined);
  assert.deepEqual(req.user, { id: "active-user", role: "PARTNER" });
});

test("a locked account's still-valid token is refused", async () => {
  const { req, error } = await run("Bearer locked-user");
  assert.equal(error.statusCode, 401);
  assert.match(error.message, /bi khoa/);
  assert.equal(req.user, undefined);
});

test("a token issued before the account's sessions were revoked is refused", async () => {
  const { req, error } = await run("Bearer old-token");
  assert.equal(error.statusCode, 401);
  assert.match(error.message, /het hieu luc/);
  assert.equal(req.user, undefined);
});

test("a missing or forged token is refused before any status lookup", async () => {
  statusLookups = [];
  assert.equal((await run()).error.statusCode, 401);
  assert.equal((await run("Bearer forged")).error.statusCode, 401);
  assert.deepEqual(statusLookups, []);
});
