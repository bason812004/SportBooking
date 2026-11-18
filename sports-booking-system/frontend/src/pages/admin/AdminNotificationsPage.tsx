import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BellRing, ChevronRight, Eye, Loader2, Send, Users } from "lucide-react";
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
  defaultAudienceByType,
  groupAudiences
} from "../../features/notifications/notificationTypes";
import { useDebounce } from "../../hooks/useDebounce";
import { formatDateTime } from "../../lib/format";
import { AdminCampaignDetailModal } from "./AdminCampaignDetailModal";
import { AdminNotificationPreview } from "./AdminNotificationPreview";
import { AdminRecipientModal, type RecipientSelection } from "./AdminRecipientModal";

type FormState = {
  title: string;
  content: string;
  type: string;
  recipients: RecipientSelection | null;
  /** Picked in the modal: a change of type then keeps it instead of switching to that type's default group. */
  recipientsPicked: boolean;
};

/** The group a type goes to until the admin picks (see defaultAudienceByType). */
function defaultRecipients(type: string): RecipientSelection | null {
  const key = defaultAudienceByType[type];
  return key ? { kind: "group", key } : null;
}

const emptyForm: FormState = { title: "", content: "", type: "SYSTEM", recipients: defaultRecipients("SYSTEM"), recipientsPicked: false };

const historyTypeOptions = [{ value: "", label: "Mọi loại" }, ...campaignTypeOptions];
const historyAudienceOptions = [{ value: "", label: "Mọi đối tượng" }, ...audienceOptions.map(({ value, label }) => ({ value, label }))];

/** The API's audience fields: a whole group, one account (USER) or several picked accounts (USERS). */
function audienceTarget(selection: RecipientSelection | null) {
  if (!selection) return null;
  if (selection.kind === "group") {
    const group = groupAudiences.find((item) => item.value === selection.key)!;
    return { targetType: group.targetType, targetRole: group.targetRole };
  }
  if (selection.people.length === 1) return { targetType: "USER", targetUserId: selection.people[0].id };
  return { targetType: "USERS", targetUserIds: selection.people.map((person) => person.id) };
}

/** "Tất cả đối tác", "An (an@mail.vn)" or "3 người: An, Bình, Chi". */
function selectionLabel(selection: RecipientSelection | null) {
  if (!selection) return "";
  if (selection.kind === "group") return groupAudiences.find((item) => item.value === selection.key)?.label ?? "";
  const [first] = selection.people;
  if (selection.people.length === 1) return `${first.fullName} (${first.email})`;
  const names = selection.people.slice(0, 3).map((person) => person.fullName).join(", ");
  return `${selection.people.length} người: ${names}${selection.people.length > 3 ? ", …" : ""}`;
}

export function AdminNotificationsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [confirming, setConfirming] = useState(false);
  const [picking, setPicking] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // The search box only queries once the admin pauses typing.
  const debouncedSearch = useDebounce(search.trim(), 300);
  const [typeFilter, setTypeFilter] = useState("");
  const [audienceFilter, setAudienceFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const target = useMemo(() => audienceTarget(form.recipients), [form.recipients]);
  // Picked accounts are counted as picked (the server sends to those still active); groups and one account are asked.
  const picked = target?.targetType === "USERS" ? target.targetUserIds!.length : null;
  const audience = useQuery({
    queryKey: ["admin-notification-audience", target],
    queryFn: () => adminApi.notificationAudience(target!),
    enabled: Boolean(target) && picked == null
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

  const audienceLabel = selectionLabel(form.recipients);
  const recipientCount = picked ?? audience.data?.count;
  // Why "Gửi thông báo" is locked, if it is: the button stays disabled rather than failing on a click.
  const sendBlocker = !target
    ? "Chọn người nhận"
    : form.title.trim().length < 3
      ? "Nhập tiêu đề (ít nhất 3 ký tự)"
      : form.content.trim().length < 3
        ? "Nhập nội dung (ít nhất 3 ký tự)"
        : recipientCount == null
          ? "Đang đếm người nhận"
          : recipientCount === 0
            ? "Không có người nhận nào đang hoạt động"
            : null;
  const canSubmit = !sendBlocker;
  const changeType = (type: string) =>
    setForm((current) => ({ ...current, type, recipients: current.recipientsPicked ? current.recipients : defaultRecipients(type) }));
  const resetForm = () => {
    setForm(emptyForm);
    setPreviewing(false);
  };
  const filter = (set: (value: string) => void) => (value: string) => {
    setPage(1);
    set(value);
  };

  return (
    <div className="space-y-6">
      <PageHero eyebrow="Nội dung" title="Trung tâm thông báo" subtitle="Soạn và gửi thông báo tới người dùng, theo dõi lịch sử, trạng thái đọc và thu hồi khi gửi nhầm." />

      {/*
        minmax(0, 1fr): the history table scrolls inside its card instead of widening the page on a phone.
        On wide screens the page fits the window (as the dashboard does): the history fills the free height and scrolls itself.
      */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:h-[calc(100dvh-7.75rem)] xl:min-h-[32rem] xl:grid-cols-[380px_minmax(0,1fr)] xl:grid-rows-[minmax(0,1fr)]">
        <section className="h-max rounded-2xl border border-line bg-white p-5 shadow-sm xl:max-h-full xl:overflow-y-auto">
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
            <div className="grid gap-1.5 text-sm font-medium text-ink">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="campaign-content">Nội dung</label>
                <div className="flex items-center gap-3 text-xs font-normal">
                  <button
                    type="button"
                    disabled={!form.title.trim() && !form.content.trim()}
                    onClick={() => setPreviewing(true)}
                    className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline"
                  >
                    <Eye className="h-3.5 w-3.5" /> Xem trước
                  </button>
                  <span className="text-slate-400">{form.content.length}/4000</span>
                </div>
              </div>
              {/* Taller than before: putting the type and the recipients on one row left this room, the form keeps its height. */}
              <textarea
                id="campaign-content"
                className="h-[210px] min-h-32 resize-y rounded-md border border-line bg-white p-3 text-sm outline-none transition focus:border-action focus:ring-2 focus:ring-emerald-100"
                value={form.content}
                maxLength={4000}
                onChange={(event) => setForm({ ...form, content: event.target.value })}
                placeholder="Nội dung đầy đủ hiển thị trong trang Thông báo của người nhận..."
              />
            </div>
            {/* The type list gives up width (it only needs room for "Khuyến mãi") so more of the picked recipients shows. */}
            <div className="grid grid-cols-[minmax(7.5rem,2fr)_minmax(0,3fr)] gap-3">
              <Select label="Loại thông báo" className="w-full min-w-0" value={form.type} onChange={(event) => changeType(event.target.value)} options={campaignTypeOptions} />
              <div className="grid min-w-0 gap-1.5 text-sm font-medium text-ink">
                <span>Đối tượng nhận</span>
                <button
                  type="button"
                  onClick={() => setPicking(true)}
                  title={audienceLabel || undefined}
                  className="flex h-10 w-full min-w-0 items-center gap-2 rounded-md border border-line bg-white px-3 text-left text-sm outline-none transition hover:border-action focus:border-action focus:ring-2 focus:ring-emerald-100"
                >
                  <Users className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className={`min-w-0 flex-1 truncate ${form.recipients ? "font-semibold text-slate-900" : "font-normal text-slate-400"}`}>
                    {audienceLabel || "Chọn người nhận"}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              </div>
            </div>

            <div className="flex min-h-11 items-center gap-2.5 rounded-xl bg-emerald-50/70 px-3 py-2 text-sm">
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${campaignTypeTone(form.type)}`}>{campaignTypeLabel(form.type)}</span>
              <span className="h-5 w-px shrink-0 bg-emerald-200" aria-hidden="true" />
              {!target ? (
                <span className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-amber-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> Chưa chọn người nhận
                </span>
              ) : picked == null && audience.isLoading ? (
                <span className="text-slate-500">Đang đếm người nhận…</span>
              ) : picked == null && audience.isError ? (
                <span className="font-semibold text-red-600">Không đếm được người nhận</span>
              ) : recipientCount === 0 ? (
                <span className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-red-600">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="truncate">{form.recipients?.kind === "people" ? "Tài khoản này đang bị khóa" : "Không có tài khoản nào đang hoạt động"}</span>
                </span>
              ) : (
                <span className="inline-flex min-w-0 items-center gap-1.5 text-emerald-900">
                  <Users className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    Đã chọn <strong>{recipientCount?.toLocaleString("vi-VN")}</strong> người nhận
                    {/* The type's default group, until the admin picks in the modal. */}
                    {!form.recipientsPicked && <span className="text-xs text-emerald-700/70"> · mặc định</span>}
                  </span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-[1fr_2fr] gap-3">
              <Button variant="secondary" disabled={create.isPending} onClick={resetForm}>
                Hủy
              </Button>
              <Button disabled={create.isPending || !canSubmit} title={sendBlocker ?? undefined} onClick={() => setConfirming(true)}>
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {create.isPending ? "Đang gửi..." : "Gửi thông báo"}
              </Button>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4 xl:min-h-0">
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
              {/* Fills the free height down to the pagination; many campaigns scroll inside, under a header that stays put. */}
              <Table minWidth="980px" wrapperClassName="xl:min-h-0 xl:flex-1">
                <THead className="sticky top-0 z-10 [&>tr]:bg-slate-50 [&_th]:shadow-[inset_0_-1px_0_#e2e8f0]">
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
      {picking && (
        <AdminRecipientModal
          value={form.recipients}
          onClose={() => setPicking(false)}
          onPick={(recipients) => {
            setForm({ ...form, recipients, recipientsPicked: true });
            setPicking(false);
          }}
        />
      )}
      {previewing && <AdminNotificationPreview title={form.title} content={form.content} type={form.type} onClose={() => setPreviewing(false)} />}

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
