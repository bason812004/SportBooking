import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Eye, Loader2, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "../../components/common/ConfirmModal";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { PageHero } from "../../components/common/PageHero";
import { Table, THead, TBody, Tr, Th, Td } from "../../components/common/Table";
import { TablePagination } from "../../components/common/TablePagination";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { adminApi } from "../../features/admin/api/adminApi";
import {
  audienceOptions,
  campaignTargetLabel,
  campaignTypeLabel,
  campaignTypeOptions,
  campaignTypeTone,
  type AudienceKey
} from "../../features/notifications/notificationTypes";
import { useDebounce } from "../../hooks/useDebounce";
import { formatDateTime } from "../../lib/format";
import { AdminCampaignDetailModal } from "./AdminCampaignDetailModal";
import { AdminRecipientPicker, type PickedRecipient } from "./AdminRecipientPicker";

type FormState = {
  title: string;
  content: string;
  type: string;
  audience: AudienceKey;
  recipient: PickedRecipient | null;
};

const emptyForm: FormState = { title: "", content: "", type: "SYSTEM", audience: "CUSTOMERS", recipient: null };

const historyTypeOptions = [{ value: "", label: "Mọi loại" }, ...campaignTypeOptions];
const historyAudienceOptions = [{ value: "", label: "Mọi đối tượng" }, ...audienceOptions.map(({ value, label }) => ({ value, label }))];

/** The API's audience fields for the picked audience; null while a single recipient is still to be chosen. */
function audienceTarget(form: Pick<FormState, "audience" | "recipient">) {
  const option = audienceOptions.find((item) => item.value === form.audience)!;
  if (option.targetType === "USER") return form.recipient ? { targetType: "USER", targetUserId: form.recipient.id } : null;
  if (option.targetType === "PARTNER") return form.recipient ? { targetType: "PARTNER", targetPartnerId: form.recipient.id } : null;
  return { targetType: option.targetType, targetRole: option.targetRole };
}

export function AdminNotificationsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [confirming, setConfirming] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // The search box only queries once the admin pauses typing.
  const debouncedSearch = useDebounce(search.trim(), 300);
  const [typeFilter, setTypeFilter] = useState("");
  const [audienceFilter, setAudienceFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const target = useMemo(() => audienceTarget(form), [form.audience, form.recipient]);
  const audience = useQuery({
    queryKey: ["admin-notification-audience", target],
    queryFn: () => adminApi.notificationAudience(target!),
    enabled: Boolean(target)
  });

  const historyFilter = audienceOptions.find((option) => option.value === audienceFilter);
  const campaigns = useQuery({
    queryKey: ["admin-notification-campaigns", debouncedSearch, typeFilter, audienceFilter, page, limit],
    queryFn: () =>
      adminApi.notificationCampaigns({
        search: debouncedSearch,
        type: typeFilter,
        targetType: historyFilter?.targetType,
        targetRole: historyFilter?.targetRole,
        page,
        limit
      }),
    placeholderData: keepPreviousData
  });

  const totalPages = campaigns.data?.meta.totalPages;
  useEffect(() => {
    if (totalPages && page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const create = useMutation({
    mutationFn: () => adminApi.createNotificationCampaign({ title: form.title.trim(), content: form.content.trim(), type: form.type, ...target! }),
    onSuccess: async (campaign) => {
      toast.success(`Đã gửi thông báo cho ${campaign.recipientCount} người nhận`);
      setConfirming(false);
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ["admin-notification-campaigns"] });
    },
    onError: (error) => {
      setConfirming(false);
      toast.error(error.message);
    }
  });

  const audienceLabel = form.recipient
    ? form.recipient.name
    : audienceOptions.find((option) => option.value === form.audience)?.label ?? "";
  const recipientCount = audience.data?.count;
  const canSubmit = form.title.trim().length >= 3 && form.content.trim().length >= 3 && Boolean(target) && Boolean(recipientCount);
  const filter = (set: (value: string) => void) => (value: string) => {
    setPage(1);
    set(value);
  };

  return (
    <div className="space-y-6">
      <PageHero eyebrow="Nội dung" title="Trung tâm thông báo" subtitle="Soạn và gửi thông báo tới người dùng, theo dõi lịch sử, trạng thái đọc và thu hồi khi gửi nhầm." />

      <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="h-max rounded-2xl border border-line bg-white p-5 shadow-sm xl:sticky xl:top-20">
          <div className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-emerald-700" />
            <h2 className="text-lg font-bold">Gửi thông báo mới</h2>
          </div>
          <div className="mt-5 space-y-4">
            <Input
              label="Tiêu đề"
              value={form.title}
              maxLength={160}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Ví dụ: Bảo trì hệ thống 02:00 - 04:00"
            />
            <label className="grid gap-1.5 text-sm font-medium text-ink">
              <span className="flex items-center justify-between">
                <span>Nội dung</span>
                <span className="text-xs font-normal text-slate-400">{form.content.length}/4000</span>
              </span>
              <textarea
                className="min-h-32 resize-y rounded-md border border-line bg-white p-3 text-sm outline-none transition focus:border-action focus:ring-2 focus:ring-emerald-100"
                value={form.content}
                maxLength={4000}
                onChange={(event) => setForm({ ...form, content: event.target.value })}
                placeholder="Nội dung đầy đủ hiển thị trong trang Thông báo của người nhận..."
              />
            </label>
            <Select label="Loại thông báo" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} options={campaignTypeOptions} />
            <Select
              label="Đối tượng nhận"
              value={form.audience}
              onChange={(event) => setForm({ ...form, audience: event.target.value as AudienceKey, recipient: null })}
              options={audienceOptions.map(({ value, label }) => ({ value, label }))}
            />
            {(form.audience === "ONE_USER" || form.audience === "ONE_PARTNER") && (
              <AdminRecipientPicker
                kind={form.audience === "ONE_USER" ? "user" : "partner"}
                value={form.recipient}
                onChange={(recipient) => setForm({ ...form, recipient })}
              />
            )}

            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-600">
              <span className={`rounded-full px-2.5 py-1 ${campaignTypeTone(form.type)}`}>{campaignTypeLabel(form.type)}</span>
              <span>→</span>
              <span>{audienceLabel}</span>
              {target && (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-slate-700">
                  <Users className="h-3 w-3" />
                  {audience.isLoading ? "..." : audience.isError ? "?" : `${recipientCount} người nhận`}
                </span>
              )}
            </div>
            {target && recipientCount === 0 && (
              <p className="text-xs font-semibold text-red-600">
                {form.recipient ? "Tài khoản này đang bị khóa nên sẽ không nhận được thông báo." : "Nhóm này hiện không có tài khoản nào đang hoạt động."}
              </p>
            )}

            <Button className="w-full" disabled={create.isPending || !canSubmit} onClick={() => setConfirming(true)}>
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {create.isPending ? "Đang gửi..." : "Gửi thông báo"}
            </Button>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">Lịch sử thông báo</h2>
            <p className="text-sm text-slate-600">Các thông báo admin đã gửi, số người đã đọc và những thông báo đã thu hồi.</p>
          </div>
          <div className="grid gap-3 rounded-2xl border border-line bg-white p-4 md:grid-cols-3">
            <Input label="Tìm kiếm" value={search} onChange={(event) => filter(setSearch)(event.target.value)} placeholder="Tiêu đề, nội dung, admin gửi" />
            <Select label="Loại" value={typeFilter} onChange={(event) => filter(setTypeFilter)(event.target.value)} options={historyTypeOptions} />
            <Select label="Đối tượng" value={audienceFilter} onChange={(event) => filter(setAudienceFilter)(event.target.value)} options={historyAudienceOptions} />
          </div>

          {/* Loading and errors replace only the list, so the filters above always stay usable. */}
          {campaigns.isLoading ? (
            <LoadingState />
          ) : campaigns.isError ? (
            <ErrorState message={campaigns.error.message} onRetry={() => campaigns.refetch()} />
          ) : !campaigns.data?.items.length ? (
            <EmptyState title="Chưa có thông báo phù hợp." description="Thử đổi bộ lọc hoặc gửi thông báo mới." />
          ) : (
            <>
              <Table minWidth="980px">
                <THead>
                  <tr>
                    <Th>Thông báo</Th>
                    <Th>Loại</Th>
                    <Th>Đối tượng</Th>
                    <Th className="text-right">Đã đọc</Th>
                    <Th>Admin gửi</Th>
                    <Th>Thời gian</Th>
                    <Th></Th>
                  </tr>
                </THead>
                <TBody>
                  {campaigns.data.items.map((campaign) => (
                    <Tr key={campaign.id} className="align-top">
                      <Td>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-slate-950">{campaign.title}</p>
                          {campaign.recalledAt && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">Đã thu hồi</span>}
                        </div>
                        <p className="line-clamp-2 text-xs text-slate-500">{campaign.content}</p>
                      </Td>
                      <Td>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${campaignTypeTone(campaign.type)}`}>
                          {campaignTypeLabel(campaign.type) ?? campaign.type}
                        </span>
                      </Td>
                      <Td className="text-sm text-slate-600">{campaignTargetLabel(campaign)}</Td>
                      <Td className="whitespace-nowrap text-right text-sm">
                        {campaign.recalledAt ? (
                          <span className="text-slate-400">–</span>
                        ) : (
                          <>
                            <span className="font-bold text-slate-900">{campaign.readCount}/{campaign.recipientCount}</span>
                            <span className="ml-1 text-xs text-slate-500">
                              ({campaign.recipientCount ? Math.round((campaign.readCount / campaign.recipientCount) * 100) : 0}%)
                            </span>
                          </>
                        )}
                      </Td>
                      <Td className="text-sm text-slate-600">{campaign.sender?.fullName ?? "-"}</Td>
                      <Td className="whitespace-nowrap text-sm text-slate-500">{formatDateTime(campaign.createdAt)}</Td>
                      <Td className="text-right">
                        <Button variant="secondary" onClick={() => setSelected(campaign.id)}>
                          <Eye className="h-4 w-4" />
                          Chi tiết
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
              <TablePagination
                page={page}
                totalPages={campaigns.data.meta.totalPages}
                total={campaigns.data.meta.total}
                limit={limit}
                itemLabel="thông báo"
                pageSizeOptions={[10, 20, 50]}
                onPageChange={setPage}
                onLimitChange={(value) => {
                  setPage(1);
                  setLimit(value);
                }}
              />
            </>
          )}
        </section>
      </div>

      {selected && <AdminCampaignDetailModal id={selected} onClose={() => setSelected(null)} />}

      <ConfirmModal
        open={confirming}
        title="Gửi thông báo?"
        message={`"${form.title.trim()}" sẽ được gửi ngay tới ${recipientCount ?? 0} người nhận (${audienceLabel}). Nếu gửi nhầm, bạn có thể thu hồi trong phần chi tiết.`}
        onCancel={() => setConfirming(false)}
        onConfirm={() => !create.isPending && create.mutate()}
      />
    </div>
  );
}
