import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { ErrorState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { adminApi } from "../../features/admin/api/adminApi";
import { groupAudiences, roleLabels, type GroupAudienceKey } from "../../features/notifications/notificationTypes";
import type { NotificationRecipientGroup } from "../../types/api";

export type PickedPerson = NotificationRecipientGroup["members"][number];
/** Who a new campaign goes to: a whole group ("Nhóm chung") or accounts picked one by one. */
export type RecipientSelection = { kind: "group"; key: GroupAudienceKey } | { kind: "people"; people: PickedPerson[] };

type Mode = "general" | "role" | "partner" | "court";
const modeOptions: Array<{ value: Mode; label: string }> = [
  { value: "general", label: "Chọn theo nhóm chung" },
  { value: "role", label: "Chọn theo vai trò" },
  { value: "partner", label: "Chọn theo đối tác" },
  { value: "court", label: "Chọn theo sân (khách đã đặt)" }
];
/** The role each whole group covers; "Mọi tài khoản" covers them all. */
const GROUP_ROLE: Record<GroupAudienceKey, string | null> = { CUSTOMERS: "USER", PARTNERS: "PARTNER", STAFF: "RECIPIENT", ALL: null };
const GROUPINGS = ["role", "partner", "court"] as const;
const GROUPS_STALE_MS = 5 * 60_000;
const SHOWN_CHIPS = 40;

/**
 * Picks who a notification goes to without remembering names or emails: a tree of groups (by role, per partner with
 * its staff, per court with the customers who booked it) to tick whole or person by person, or one whole group.
 * Nothing changes until "Chọn"; "Đóng" (or Esc) drops the changes. Mounted per opening, so it starts from `value`.
 */
export function AdminRecipientModal({ value, onPick, onClose }: {
  value: RecipientSelection | null;
  onPick: (selection: RecipientSelection) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>(value?.kind === "group" ? "general" : "role");
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<GroupAudienceKey | null>(value?.kind === "group" ? value.key : null);
  const [people, setPeople] = useState<Map<string, PickedPerson>>(
    () => new Map(value?.kind === "people" ? value.people.map((person) => [person.id, person]) : [])
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Every grouping loads as the modal opens (and stays a while), so switching "Chọn theo" shows it at once.
  const groupQueries = useQueries({
    queries: GROUPINGS.map((by) => ({
      queryKey: ["admin-recipient-groups", by],
      queryFn: () => adminApi.notificationRecipientGroups(by),
      staleTime: GROUPS_STALE_MS
    }))
  });
  // The roles also give the whole groups their sizes.
  const roles = groupQueries[0];
  const tree = mode === "general" ? null : groupQueries[GROUPINGS.indexOf(mode)];

  const term = search.trim().toLocaleLowerCase("vi");
  const visibleGroups = useMemo(() => {
    const groups = tree?.data ?? [];
    if (!term) return groups.map((item) => ({ group: item, members: item.members }));
    const matches = (text: string) => text.toLocaleLowerCase("vi").includes(term);
    return groups
      .map((item) => ({
        group: item,
        members: matches(item.name) ? item.members : item.members.filter((member) => matches(member.fullName) || matches(member.email))
      }))
      .filter((item) => item.members.length);
  }, [tree?.data, term]);

  const groupSize = (key: GroupAudienceKey) => {
    const role = GROUP_ROLE[key];
    return (roles.data ?? []).filter((item) => role == null || item.id === role).reduce((sum, item) => sum + item.members.length, 0);
  };

  const pickPeople = (members: PickedPerson[], on: boolean) => {
    setGroup(null);
    setPeople((current) => {
      const next = new Map(current);
      for (const member of members) {
        if (on) next.set(member.id, member);
        else next.delete(member.id);
      }
      return next;
    });
  };
  const toggleExpanded = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const picked = [...people.values()];
  const selection: RecipientSelection | null = group ? { kind: "group", key: group } : picked.length ? { kind: "people", people: picked } : null;
  const groupLabel = group ? groupAudiences.find((item) => item.value === group)?.label : null;

  return (
    <Modal isOpen onClose={onClose} title="Chọn người nhận" maxWidth="max-w-3xl">
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <Select
              aria-label="Chọn theo"
              className="w-full min-w-0"
              value={mode}
              onChange={(event) => setMode(event.target.value as Mode)}
              options={modeOptions}
            />
          </div>
          <Button disabled={!selection} onClick={() => selection && onPick(selection)}>
            Chọn
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
        </div>
        {/* The box keeps one size in every mode: the search keeps its room (hidden for whole groups), the tree a fixed height. */}
        <div className={mode === "general" ? "invisible" : undefined} aria-hidden={mode === "general"}>
          <Input
            aria-label="Tìm tên hoặc email"
            placeholder="Tìm tên hoặc email"
            value={search}
            tabIndex={mode === "general" ? -1 : undefined}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {/* The modal's 90vh less everything around the tree (~24rem), so the box fills it whole without scrolling itself. */}
        <div className="h-[calc(90vh-24rem)] min-h-[10rem] overflow-y-auto rounded-xl border border-line p-2">
          {mode === "general" || !tree ? (
            roles.isError ? (
              <ErrorState message={roles.error.message} onRetry={() => roles.refetch()} />
            ) : (
              <div className="space-y-1">
                {groupAudiences.map((item) => (
                  <label key={item.value} className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${group === item.value ? "bg-emerald-50" : "hover:bg-slate-50"}`}>
                    <input
                      type="radio"
                      name="recipient-group"
                      className="h-4 w-4 accent-emerald-600"
                      checked={group === item.value}
                      onChange={() => {
                        setGroup(item.value);
                        setPeople(new Map());
                      }}
                    />
                    <span className="font-semibold">{item.label}</span>
                    <span className="text-slate-500">({roles.isLoading ? "…" : groupSize(item.value)})</span>
                  </label>
                ))}
              </div>
            )
          ) : tree.isLoading ? (
            <p className="p-3 text-sm text-slate-500">Đang tải danh sách…</p>
          ) : tree.isError ? (
            <ErrorState message={tree.error.message} onRetry={() => tree.refetch()} />
          ) : !visibleGroups.length ? (
            <p className="flex items-center gap-2 p-3 text-sm text-slate-500">
              <Search className="h-4 w-4" /> {term ? "Không tìm thấy ai phù hợp." : "Chưa có tài khoản nào trong cách nhóm này."}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {visibleGroups.map(({ group: item, members }) => {
                const selectedCount = item.members.filter((member) => people.has(member.id)).length;
                const open = Boolean(term) || expanded.has(item.id);
                return (
                  <li key={item.id}>
                    <div className="flex items-center gap-1.5 rounded-lg px-1 py-1 hover:bg-slate-50">
                      <button
                        type="button"
                        aria-label={open ? `Thu gọn ${item.name}` : `Mở ${item.name}`}
                        aria-expanded={open}
                        className="rounded p-0.5 text-slate-600 hover:bg-slate-200"
                        onClick={() => toggleExpanded(item.id)}
                      >
                        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0 accent-emerald-600"
                          checked={selectedCount === item.members.length}
                          ref={(element) => {
                            if (element) element.indeterminate = selectedCount > 0 && selectedCount < item.members.length;
                          }}
                          onChange={() => pickPeople(item.members, selectedCount < item.members.length)}
                        />
                        <span className="truncate font-semibold">
                          {item.name} <span className="font-normal text-slate-500">({item.members.length})</span>
                        </span>
                        {item.detail && <span className="hidden truncate text-xs text-slate-500 sm:inline">· {item.detail}</span>}
                      </label>
                    </div>
                    {open && (
                      <ul className="mb-1 ml-7 border-l border-slate-100 pl-2">
                        {members.map((member) => (
                          <li key={member.id}>
                            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-sm hover:bg-slate-50">
                              <input
                                type="checkbox"
                                className="h-4 w-4 shrink-0 accent-emerald-600"
                                checked={people.has(member.id)}
                                onChange={(event) => pickPeople([member], event.target.checked)}
                              />
                              <span className="min-w-0 truncate">
                                {member.fullName}
                                <span className="ml-2 text-xs text-slate-500">
                                  {member.email} · {roleLabels[member.role] ?? member.role}
                                </span>
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-slate-700">
              {groupLabel ? `Đã chọn: ${groupLabel}` : `Đã chọn ${picked.length} người`}
            </p>
            {selection && (
              <button
                type="button"
                className="text-xs font-semibold text-slate-500 hover:text-red-600"
                onClick={() => {
                  setGroup(null);
                  setPeople(new Map());
                }}
              >
                Bỏ chọn tất cả
              </button>
            )}
          </div>
          {/* A fixed height, scrolling inside, so picking more people never grows the modal. */}
          <div className="mt-2 flex h-24 flex-wrap content-start gap-1.5 overflow-y-auto">
            {groupLabel ? (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                {groupLabel} ({groupSize(group!)} người)
              </span>
            ) : !picked.length ? (
              <span className="py-1 text-xs text-slate-400">Chưa chọn ai.</span>
            ) : null}
            {picked.slice(0, SHOWN_CHIPS).map((person) => (
              <span key={person.id} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                {person.fullName}
                <button type="button" aria-label={`Bỏ ${person.fullName}`} className="rounded-full text-slate-400 hover:text-red-600" onClick={() => pickPeople([person], false)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {picked.length > SHOWN_CHIPS && <span className="px-1 py-1 text-xs text-slate-500">+{picked.length - SHOWN_CHIPS} người nữa</span>}
          </div>
        </div>
      </div>
    </Modal>
  );
}
