import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { auditHash, canonicalJson } from "./admin.audit.js";

const entry = {
  actorId: "u0001",
  action: "WITHDRAWAL_PAID",
  entityType: "WITHDRAWAL",
  entityId: "wr0001",
  previousHash: "a".repeat(64)
};

describe("audit hashing", () => {
  it("does not depend on key order, so metadata read back from jsonb hashes as written", () => {
    // jsonb returns keys shortest first: {partnerId, amount} comes back as {amount, partnerId}.
    const written = auditHash({ ...entry, metadata: { partnerId: "pp0001", amount: 500000, detail: { b: 1, a: [{ y: 2, x: 1 }] } } });
    const readBack = auditHash({ ...entry, metadata: { amount: 500000, detail: { a: [{ x: 1, y: 2 }], b: 1 }, partnerId: "pp0001" } });
    assert.equal(written, readBack);
  });

  it("changes when anything recorded changes", () => {
    const base = auditHash({ ...entry, metadata: { amount: 500000 } });
    assert.notEqual(auditHash({ ...entry, metadata: { amount: 500001 } }), base);
    assert.notEqual(auditHash({ ...entry, actorId: null, metadata: { amount: 500000 } }), base);
    assert.notEqual(auditHash({ ...entry, previousHash: null, metadata: { amount: 500000 } }), base);
  });

  it("hashes values as JSON stores them: dates as strings, missing metadata and undefined fields as absent", () => {
    const at = new Date("2026-10-28T03:00:00.000Z");
    assert.equal(canonicalJson({ at, skip: undefined }), '{"at":"2026-10-28T03:00:00.000Z"}');
    assert.equal(auditHash({ ...entry, metadata: undefined }), auditHash({ ...entry, metadata: null }));
  });
});
