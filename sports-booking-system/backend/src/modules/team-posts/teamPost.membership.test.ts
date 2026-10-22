import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

let exists = true;
let member = false;
let memberReads = 0;
mock.module("./teamPost.repository.js", {
  namedExports: {
    teamPostRepository: {
      findById: async () => exists ? [{ id: "tp0001" }] : [],
      isMember: async (id: string, userId: string) => {
        assert.equal(id, "tp0001");
        assert.equal(userId, "u1");
        return member;
      },
      listMembers: async () => {
        memberReads++;
        return [{ userId: "u1" }];
      }
    }
  }
});
mock.module("../realtime/realtime.service.js", { namedExports: { realtimeService: {} } });
const { teamPostService } = await import("./teamPost.service.js");

beforeEach(() => {
  exists = true;
  member = false;
  memberReads = 0;
});

test("non-member can check membership without reading the protected member list", async () => {
  assert.deepEqual(await teamPostService.membership("tp0001", "u1"), { isMember: false });
  await assert.rejects(teamPostService.members("tp0001", "u1"), { statusCode: 403 });
  assert.equal(memberReads, 0);
});

test("membership follows join and leave, and member access remains protected", async () => {
  member = true;
  assert.deepEqual(await teamPostService.membership("tp0001", "u1"), { isMember: true });
  assert.deepEqual(await teamPostService.members("tp0001", "u1"), [{ userId: "u1" }]);
  member = false;
  assert.deepEqual(await teamPostService.membership("tp0001", "u1"), { isMember: false });
  await assert.rejects(teamPostService.members("tp0001", "u1"), { statusCode: 403 });
  assert.equal(memberReads, 1);
});

test("missing post returns 404 instead of a misleading membership result", async () => {
  exists = false;
  await assert.rejects(teamPostService.membership("tp0001", "u1"), { statusCode: 404 });
});
