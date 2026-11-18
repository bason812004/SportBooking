import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recipientGroups } from "./admin.campaignRecipients.js";

const row = (groupId: string, groupName: string, id: string, fullName: string, role = "USER", groupDetail: string | null = null) => ({
  groupId,
  groupName,
  groupDetail,
  id,
  fullName,
  email: `${id}@mail.vn`,
  role
});

describe("notification recipient groups", () => {
  it("orders roles customers, partners, staff, admins, with Vietnamese names and members by name", () => {
    const groups = recipientGroups(
      [row("RECIPIENT", "RECIPIENT", "s1", "Lan", "RECIPIENT"), row("USER", "USER", "u2", "Bình"), row("PARTNER", "PARTNER", "p1", "Chi", "PARTNER"), row("USER", "USER", "u1", "An")],
      "role"
    );
    assert.deepEqual(groups.map((group) => group.name), ["Khách hàng", "Đối tác", "Nhân viên sân"]);
    assert.deepEqual(groups[0].members.map((member) => member.fullName), ["An", "Bình"]);
  });

  it("lists an account once per group even when it booked a court many times, and sorts other groups by name", () => {
    const groups = recipientGroups(
      [
        row("c2", "Sân Bình Thạnh", "u1", "An", "USER", "Sai Gon Sport Hub"),
        row("c1", "Sân An Phú", "u1", "An", "USER", "Sai Gon Sport Hub"),
        row("c1", "Sân An Phú", "u1", "An", "USER", "Sai Gon Sport Hub"),
        row("c1", "Sân An Phú", "u2", "Bình")
      ],
      "court"
    );
    assert.deepEqual(groups.map((group) => [group.name, group.members.length]), [["Sân An Phú", 2], ["Sân Bình Thạnh", 1]]);
    assert.equal(groups[0].detail, "Sai Gon Sport Hub");
  });
});
