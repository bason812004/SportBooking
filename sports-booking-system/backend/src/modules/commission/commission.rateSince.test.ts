import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { partnerRateSince } from "./commission.rateSince.js";

const joinedAt = new Date("2026-07-16T02:00:00Z");
const day = (iso: string, changedBy = "Admin") => ({ at: new Date(iso), changedBy });

describe("since when a partner's commission rate applies", () => {
  it("is the day it joined while nothing changed its rate", () => {
    assert.deepEqual(partnerRateSince({ overrideRate: null, joinedAt, partnerChange: null, defaultChange: null }), { at: joinedAt, changedBy: null, reason: "JOINED" });
  });

  it("follows the last change of the default for a partner on the default", () => {
    const since = partnerRateSince({ overrideRate: null, joinedAt, partnerChange: null, defaultChange: day("2026-09-01T03:00:00Z") });
    assert.equal(since.reason, "DEFAULT_CHANGED");
    assert.equal(since.at.toISOString(), "2026-09-01T03:00:00.000Z");
  });

  it("ignores changes of the default once the partner has its own rate", () => {
    const since = partnerRateSince({
      overrideRate: 8,
      joinedAt,
      partnerChange: day("2026-08-01T03:00:00Z", "An"),
      defaultChange: day("2026-10-01T03:00:00Z")
    });
    assert.deepEqual(since, { at: new Date("2026-08-01T03:00:00Z"), changedBy: "An", reason: "OVERRIDE_SET" });
  });

  it("dates a partner back on the default from whichever came last: dropping its own rate or changing the default", () => {
    const dropped = partnerRateSince({ overrideRate: null, joinedAt, partnerChange: day("2026-10-05T03:00:00Z"), defaultChange: day("2026-09-01T03:00:00Z") });
    assert.equal(dropped.reason, "OVERRIDE_REMOVED");
    const defaultLater = partnerRateSince({ overrideRate: null, joinedAt, partnerChange: day("2026-08-05T03:00:00Z"), defaultChange: day("2026-09-01T03:00:00Z") });
    assert.equal(defaultLater.reason, "DEFAULT_CHANGED");
  });

  it("never dates a rate before the partner joined", () => {
    const since = partnerRateSince({ overrideRate: null, joinedAt, partnerChange: null, defaultChange: day("2026-05-01T03:00:00Z") });
    assert.equal(since.reason, "JOINED");
  });
});
