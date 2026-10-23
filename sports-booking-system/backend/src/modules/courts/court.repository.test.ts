import assert from "node:assert/strict";
import { test, mock } from "node:test";

// Records every Prisma call so a read path that starts writing (e.g. padding sub-courts) is caught.
const calls: string[] = [];
const prisma: any = new Proxy({}, {
  get(_target, model) {
    if (String(model).startsWith("$")) return async () => { calls.push(String(model)); return 0; };
    return new Proxy({}, { get: (_inner, method) => async () => { calls.push(`${String(model)}.${String(method)}`); return null; } });
  }
});
mock.module("../../config/db.js", { namedExports: { prisma } });
const { courtRepository } = await import("./court.repository.js");

test("public court detail is read-only and never pads the venue with sub-courts", async () => {
  await courtRepository.findPublicById("c1");
  await courtRepository.findPublicById("c2");
  assert.deepEqual(calls, ["court.findFirst", "court.findFirst"]);
});
