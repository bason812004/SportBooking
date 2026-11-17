import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, LoadingState } from "../../components/common/States";
import { Table, TBody, Td, Th, THead, Tr } from "../../components/common/Table";
import { TablePagination } from "../../components/common/TablePagination";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { adminApi } from "../../features/admin/api/adminApi";
import { campaignTargetLabel, campaignTypeLabel, campaignTypeTone, roleLabels } from "../../features/notifications/notificationTypes";
import { useDebounce } from "../../hooks/useDebounce";
import { formatDateTime } from "../../lib/format";
import { ReasonModal } from "../../components/common/ReasonModal";

const readOptions = [
  { value: "", label: "Tất cả" },
  { value: "false", label: "Chưa đọc" },
  { value: "true", label: "Đã đọc" }
];

/** A sent campaign: its text, how many read it (over every recipient), who received it, and recalling it. */
export function AdminCampaignDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const term = useDebounce(search.trim(), 300);
  const [read, setRead] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [recalling, setRecalling] = useState(false);

  const detail = useQuery({ queryKey: ["admin-notification-campaign", id], queryFn: () => adminApi.notificationCampaignDetail(id) });
  const recipients = useQuery({
    queryKey: ["admin-notification-campaign-recipients", id, term, read, page, limit],
    queryFn: () => adminApi.notificationCampaignRecipients(id, { search: term, read, page, limit }),
    placeholderData: keepPreviousData
  });

  const recall = useMutation({
    mutationFn: (reason: string) => adminApi.recallNotificationCampaign(id, reason),
    onSuccess: async (result) => {
      toast.success(`Đã thu hồi thông báo khỏi ${result.removed} hộp thư`);
      setRecalling(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-notification-campaigns"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-notification-campaign", id] }),
        queryClient.invalidateQueries({ queryKey: ["admin-notification-campaign-recipients", id] })
      ]);
    },
    onError: (error) => toast.error(error.message)
  });

  const campaign = detail.data;
  const filter = (set: (value: string) => void) => (value: string) => {
    setPage(1);
    set(value);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6" onMouseDown={onClose}>
        <div className="flex max-h-[calc(100vh-48px)] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
          <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
            <h3 className="text-xl font-bold">Chi tiết thông báo</h3>
            <button onClick={onClose} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Đóng">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="min-h-0 space-y-5 overflow-y-auto p-5">
            {detail.isLoading && <LoadingState />}
            {detail.isError && <ErrorState message={detail.error.message} onRetry={() => detail.refetch()} />}
            {campaign && (
              <>
                {campaign.recalledAt && (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    Đã thu hồi lúc {formatDateTime(campaign.recalledAt)}
                    {campaign.recalledByName ? ` bởi ${campaign.recalledByName}` : ""}. Lý do: {campaign.recallReason}. Người nhận không còn thấy thông báo này.
                  </p>
                )}

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${campaignTypeTone(campaign.type)}`}>
                      {campaignTypeLabel(campaign.type) ?? campaign.type}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">
                      {formatDateTime(campaign.createdAt)}{campaign.sender ? ` · ${campaign.sender.fullName}` : ""}
                    </span>
                  </div>
                  <h4 className="mt-2 text-lg font-bold text-slate-950">{campaign.title}</h4>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{campaign.content}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Info label="Đối tượng" value={campaignTargetLabel(campaign)} />
                  <Info label="Người nhận" value={String(campaign.recipientCount)} />
                  <Info
                    label="Đã đọc / Chưa đọc"
                    value={campaign.recalledAt ? "Đã thu hồi" : `${campaign.readCount} / ${campaign.unreadCount ?? 0}`}
                  />
                </div>

                {!campaign.recalledAt && (
                  <>
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                      <Input label="Tìm người nhận (tên, email)" value={search} onChange={(event) => filter(setSearch)(event.target.value)} />
                      <Select label="Trạng thái đọc" value={read} onChange={(event) => filter(setRead)(event.target.value)} options={readOptions} />
                    </div>
                    {recipients.isLoading ? (
                      <LoadingState />
                    ) : recipients.isError ? (
                      <ErrorState message={recipients.error.message} onRetry={() => recipients.refetch()} />
                    ) : (
                      <>
                        <Table minWidth="720px">
                          <THead>
                            <tr>
                              <Th>Người nhận</Th>
                              <Th>Email</Th>
                              <Th>Vai trò</Th>
                              <Th>Trạng thái đọc</Th>
                            </tr>
                          </THead>
                          <TBody>
                            {recipients.data?.items.map((item) => (
                              <Tr key={item.id}>
                                <Td className="font-medium">{item.user.fullName}</Td>
                                <Td className="text-slate-600">{item.user.email}</Td>
                                <Td className="text-slate-600">{roleLabels[item.user.role] ?? item.user.role}</Td>
                                <Td>
                                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${item.isRead ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                    {item.isRead ? (item.readAt ? `Đã đọc ${formatDateTime(item.readAt)}` : "Đã đọc") : "Chưa đọc"}
                                  </span>
                                </Td>
                              </Tr>
                            ))}
                          </TBody>
                        </Table>
                        {!recipients.data?.items.length && <p className="text-center text-sm text-slate-500">Không có người nhận phù hợp.</p>}
                        <TablePagination
                          page={page}
                          totalPages={recipients.data?.meta.totalPages ?? 1}
                          total={recipients.data?.meta.total ?? 0}
                          limit={limit}
                          itemLabel="người nhận"
                          pageSizeOptions={[10, 25, 50]}
                          onPageChange={setPage}
                          onLimitChange={(value) => {
                            setPage(1);
                            setLimit(value);
                          }}
                        />
                      </>
                    )}

                    <div className="flex justify-end">
                      <Button variant="danger" disabled={recall.isPending} onClick={() => setRecalling(true)}>
                        <Undo2 className="h-4 w-4" /> Thu hồi thông báo
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* A sibling of the backdrop: clicks inside it must not close the detail dialog. */}
      <ReasonModal
        key={recalling ? "recall-open" : "recall-closed"}
        open={recalling}
        title="Thu hồi thông báo khỏi hộp thư của mọi người nhận"
        required
        onClose={() => setRecalling(false)}
        onConfirm={(reason) => !recall.isPending && recall.mutate(reason)}
      />
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words font-bold text-slate-950">{value}</p>
    </div>
  );
}
