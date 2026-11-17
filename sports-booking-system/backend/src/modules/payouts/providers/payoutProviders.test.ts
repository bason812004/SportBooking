import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

const config: Record<string, unknown> = { PAYOUT_PROVIDER: "manual", NODE_ENV: "development" };
mock.module("../../../config/env.js", { namedExports: { env: config } });

let caseId = 0;
// index.ts picks the provider when it is evaluated, so each case loads a fresh copy.
function load(overrides: Record<string, unknown>) {
  Object.assign(config, { PAYOUT_PROVIDER: "manual", NODE_ENV: "development" }, overrides);
  caseId += 1;
  return import(`./index.js?case=${caseId}`);
}

describe("payout provider selection", () => {
  it("manual (the default) has no provider: an admin confirms every transfer", async () => {
    const { activePayoutProvider } = await load({});
    assert.equal(activePayoutProvider(), null);
  });

  it("the fake simulator is available for demos outside production", async () => {
    const { activePayoutProvider } = await load({ PAYOUT_PROVIDER: "fake" });
    assert.notEqual(activePayoutProvider(), null);
  });

  it("the fake simulator is refused in production, since it marks transfers done without moving money", async () => {
    await assert.rejects(load({ PAYOUT_PROVIDER: "fake", NODE_ENV: "production" }), /chi dung de demo/);
  });
});
