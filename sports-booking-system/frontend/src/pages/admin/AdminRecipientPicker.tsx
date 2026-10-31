import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { Input } from "../../components/ui/Input";
import { adminApi } from "../../features/admin/api/adminApi";
import { roleLabels } from "../../features/notifications/notificationTypes";
import { useDebounce } from "../../hooks/useDebounce";

export type PickedRecipient = { id: string; name: string; detail: string };

/**
 * Finds the one account or partner a notification goes to by name, email or business name, instead of typing an
 * internal id. Only active accounts are offered for a single account, since locked ones receive nothing.
 */
export function AdminRecipientPicker({ kind, value, onChange }: {
  kind: "user" | "partner";
  value: PickedRecipient | null;
  onChange: (next: PickedRecipient | null) => void;
}) {
  const [search, setSearch] = useState("");
  const term = useDebounce(search.trim(), 300);
  const results = useQuery({
    queryKey: ["admin-recipient-picker", kind, term],
    queryFn: async (): Promise<PickedRecipient[]> => {
      if (kind === "user") {
        const page = await adminApi.users({ search: term, status: "ACTIVE", limit: 6 });
        return page.items.map((user) => ({
          id: user.id,
          name: user.fullName,
          detail: `${user.email} · ${roleLabels[user.role] ?? user.role}${user.partnerProfile ? ` · ${user.partnerProfile.businessName}` : ""}`
        }));
      }
      const page = await adminApi.partners({ search: term, limit: 6 });
      return page.items.map((partner) => ({
        id: partner.id,
        name: partner.businessName,
        detail: `${partner.user.fullName} · ${partner.user.email}${partner.user.status === "LOCKED" ? " · đang bị khóa" : ""}`
      }));
    },
    enabled: !value && term.length >= 2
  });

  if (value) {
    return (
      <div className="flex items-start justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-950">{value.name}</p>
          <p className="truncate text-xs text-slate-600">{value.detail}</p>
        </div>
        <button className="rounded-full p-1 text-slate-500 hover:bg-emerald-100" aria-label="Chọn người khác" onClick={() => onChange(null)}>
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Input
        label={kind === "user" ? "Tìm tài khoản (tên, email)" : "Tìm đối tác (tên doanh nghiệp, email)"}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Nhập ít nhất 2 ký tự"
      />
      {term.length >= 2 && (
        <div className="max-h-56 overflow-y-auto rounded-xl border border-line bg-white">
          {results.isLoading ? (
            <p className="p-3 text-sm text-slate-500">Đang tìm...</p>
          ) : results.isError ? (
            <p className="p-3 text-sm text-red-600">{results.error.message}</p>
          ) : !results.data?.length ? (
            <p className="flex items-center gap-2 p-3 text-sm text-slate-500"><Search className="h-4 w-4" /> Không tìm thấy</p>
          ) : (
            results.data.map((item) => (
              <button
                key={item.id}
                className="block w-full border-b border-slate-50 px-3 py-2 text-left last:border-0 hover:bg-slate-50"
                onClick={() => {
                  onChange(item);
                  setSearch("");
                }}
              >
                <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                <p className="truncate text-xs text-slate-500">{item.detail}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
