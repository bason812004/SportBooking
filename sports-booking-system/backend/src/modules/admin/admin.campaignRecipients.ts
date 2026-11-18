/**
 * The groups of the admin's notification recipient picker (the tree under "Chọn theo"): accounts by role, a
 * partner's owner and staff, or a court's customers. Each group lists its accounts once, by name.
 */
import type { CampaignRecipientRow } from "./admin.repository.js";

export type RecipientGrouping = "role" | "partner" | "court";

const ROLE_ORDER = ["USER", "PARTNER", "RECIPIENT", "ADMIN"];
const ROLE_GROUP_NAMES: Record<string, string> = {
  USER: "Khách hàng",
  PARTNER: "Đối tác",
  RECIPIENT: "Nhân viên sân",
  ADMIN: "Quản trị viên"
};

export function recipientGroups(rows: CampaignRecipientRow[], by: RecipientGrouping) {
  const groups = new Map<string, { id: string; name: string; detail: string | null; members: Map<string, { id: string; fullName: string; email: string; role: string }> }>();
  for (const row of rows) {
    const group = groups.get(row.groupId) ?? {
      id: row.groupId,
      name: by === "role" ? ROLE_GROUP_NAMES[row.groupId] ?? row.groupName : row.groupName,
      detail: row.groupDetail,
      members: new Map()
    };
    group.members.set(row.id, { id: row.id, fullName: row.fullName, email: row.email, role: row.role });
    groups.set(row.groupId, group);
  }

  const byName = (left: { name: string }, right: { name: string }) => left.name.localeCompare(right.name, "vi");
  const rank = (id: string) => (ROLE_ORDER.includes(id) ? ROLE_ORDER.indexOf(id) : ROLE_ORDER.length);
  return [...groups.values()]
    .map((group) => ({
      ...group,
      members: [...group.members.values()].sort((left, right) => left.fullName.localeCompare(right.fullName, "vi"))
    }))
    .filter((group) => group.members.length > 0)
    .sort((left, right) => (by === "role" ? rank(left.id) - rank(right.id) : byName(left, right)));
}
