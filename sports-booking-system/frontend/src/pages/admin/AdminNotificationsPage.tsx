import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Eye, Loader2, Send, Users, X } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, LoadingState } from "../../components/common/States";
import { PageHero } from "../../components/common/PageHero";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { adminApi } from "../../features/admin/api/adminApi";
import { Table, THead, TBody, Tr, Th, Td } from "../../components/common/Table";

const notificationTypes = [
  { value: "SYSTEM", label: "Hệ thống" },
  { value: "APPROVAL", label: "Duyệt" },
  { value: "REJECTION", label: "Từ chối" },
  { value: "FINANCE", label: "Tài chính" },
  { value: "INCIDENT", label: "Sự cố" },
  { value: "COURT_UPDATE_REQUESTED", label: "Yêu cầu cập nhật sân" }
];

const typeTone: Record<string, string> = {
  SYSTEM: "bg-slate-100 text-slate-700",
  APPROVAL: "bg-emerald-100 text-emerald-700",
  REJECTION: "bg-rose-100 text-rose-700",
  FINANCE: "bg-amber-100 text-amber-700",
  INCIDENT: "bg-red-100 text-red-700",
  COURT_UPDATE_REQUESTED: "bg-sky-100 text-sky-700"
};

const targetTypes = [
  { value: "ALL", label: "Tất cả người dùng" },
  { value: "ROLE", label: "Theo vai trò" },
  { value: "USER", label: "Một user" },
  { value: "PARTNER", label: "Một partner" }
];

const roleOptions = [
  { value: "USER", label: "User" },
  { value: "PARTNER", label: "Partner" },
  { value: "ADMIN", label: "Admin" }
];

type FormState = {
  title: string;
  content: string;
  type: string;
  targetType: string;
  targetRole: string;
  targetUserId: string;
  targetPartnerId: string;
};

const emptyForm: FormState = {
  title: "",
  content: "",
  type: "SYSTEM",
  targetType: "ALL",
  targetRole: "USER",
  targetUserId: "",
  targetPartnerId: ""
};

export function AdminNotificationsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const campaigns = useQuery({
    queryKey: ["admin-notification-campaigns", page, search],
    queryFn: () => adminApi.notificationCampaigns({ page, limit: 10, search })
  });
  const detail = useQuery({
    queryKey: ["admin-notification-campaign", selected],
    queryFn: () => adminApi.notificationCampaignDetail(selected!),
    enabled: Boolean(selected)
  });

  const create = useMutation({
    mutationFn: () => adminApi.createNotificationCampaign(toPayload(form)),
    onSuccess: async (campaign) => {
      toast.success(`Đã gửi thông báo cho ${campaign.recipientCount} người nhận`);
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ["admin-notification-campaigns"] });
    },
    onError: (error) => toast.error(error.message)
  });

  useEffect(() => {
    if (form.targetType !== "ROLE") setForm((current) => ({ ...current, targetRole: "USER" }));
  }, [form.targetType]);

  const totalPages = campaigns.data?.meta.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Nội dung"
        title="Trung tâm thông báo"
        subtitle="Soạn và gửi thông báo tới người dùng, theo dõi lịch sử và trạng thái đọc."
      />

      <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="h-max rounded-2xl border border-line bg-white p-5 shadow-sm xl:sticky xl:top-5">
          <div className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-emerald-700" />
            <h2 className="text-lg font-bold">Gửi thông báo mới</h2>
          </div>
          <div className="mt-5 space-y-4">
            <Input label="Tiêu đề" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Ví dụ: Bảo trì hệ thống 02:00 - 04:00" />
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
                placeholder="Nội dung chi tiết sẽ hiển thị cho người nhận..."
              />
            </label>
            <Select label="Loại thông báo" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} options={notificationTypes} />
            <Select label="Đối tượng nhận" value={form.targetType} onChange={(event) => setForm({ ...form, targetType: event.target.value })} options={targetTypes} />
            {form.targetType === "ROLE" && (
              <Select label="Vai trò" value={form.targetRole} onChange={(event) => setForm({ ...form, targetRole: event.target.value })} options={roleOptions} />
            )}
            {form.targetType === "USER" && (
              <Input label="User ID" value={form.targetUserId} onChange={(event) => setForm({ ...form, targetUserId: event.target.value })} placeholder="u0001" />
            )}
            {form.targetType === "PARTNER" && (
              <Input label="Partner ID" value={form.targetPartnerId} onChange={(event) => setForm({ ...form, targetPartnerId: event.target.value })} placeholder="pp0001" />
            )}

            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-500">
              <span className={`rounded-full px-2.5 py-1 ${typeTone[form.type] ?? "bg-slate-100 text-slate-700"}`}>{typeLabel(form.type)}</span>
              <span>→</span>
              <span>{targetLabel({ targetType: form.targetType, targetRole: form.targetRole, targetUserId: form.targetUserId, targetPartnerId: form.targetPartnerId })}</span>
            </div>

            <Button className="w-full" disabled={create.isPending || !canSubmit(form)} onClick={() => create.mutate()}>
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {create.isPending ? "Đang gửi..." : "Gửi thông báo"}
            </Button>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Lịch sử thông báo</h2>
              <p className="text-sm text-slate-600">Theo dõi các chiến dịch thông báo admin đã gửi.</p>
            </div>
            <Input label="Tìm kiếm" value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder="Tiêu đề, nội dung, admin gửi" />
          </div>

          {campaigns.isLoading ? (
            <LoadingState />
          ) : campaigns.isError ? (
            <ErrorState message={campaigns.error.message} />
          ) : (
            <>
              <Table minWidth="920px">
                <THead>
                  <tr>
                    <Th>Thông báo</Th>
                    <Th>Loại</Th>
                    <Th>Đối tượng</Th>
                    <Th className="text-right">Người nhận</Th>
                    <Th>Admin gửi</Th>
                    <Th>Thời gian</Th>
                    <Th></Th>
                  </tr>
                </THead>
                <TBody>
                  {campaigns.data?.items.map((campaign) => (
                    <Tr key={campaign.id} className="align-top">
                      <Td>
                        <p className="font-bold text-slate-950">{campaign.title}</p>
                        <p className="line-clamp-2 text-xs text-slate-500">{campaign.content}</p>
                      </Td>
                      <Td>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${typeTone[campaign.type] ?? "bg-slate-100 text-slate-700"}`}>
                          {typeLabel(campaign.type)}
                        </span>
                      </Td>
                      <Td className="text-sm text-slate-600">{targetLabel(campaign)}</Td>
                      <Td className="text-right">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                          <Users className="h-3 w-3" />
                          {campaign.recipientCount}
                        </span>
                      </Td>
                      <Td className="text-sm text-slate-600">{campaign.sender?.fullName ?? "-"}</Td>
                      <Td className="whitespace-nowrap text-sm text-slate-500">{new Date(campaign.createdAt).toLocaleString("vi-VN")}</Td>
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
              {!campaigns.data?.items.length && (
                <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
                  <BellRing className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 font-semibold text-slate-500">Chưa có thông báo nào</p>
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex items-center justify-end gap-3">
                  <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</Button>
                  <span className="text-sm font-semibold text-slate-500">Trang {page}/{totalPages}</span>
                  <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Sau</Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6" onMouseDown={() => setSelected(null)}>
          <div className="flex max-h-[calc(100vh-48px)] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
              <h3 className="text-xl font-bold">Chi tiết thông báo</h3>
              <button
                onClick={() => setSelected(null)}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Đóng"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto p-5">
              {detail.isLoading && <LoadingState />}
              {detail.isError && <ErrorState message={detail.error.message} />}
              {detail.data && (
                <div className="space-y-5">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${typeTone[detail.data.type] ?? "bg-slate-100 text-slate-700"}`}>
                        {typeLabel(detail.data.type)}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">{new Date(detail.data.createdAt).toLocaleString("vi-VN")}</span>
                    </div>
                    <h4 className="mt-2 text-lg font-bold text-slate-950">{detail.data.title}</h4>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{detail.data.content}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <Info label="Đối tượng" value={targetLabel(detail.data)} />
                    <Info label="Người nhận" value={String(detail.data.recipientCount)} />
                    <Info
                      label="Đã đọc / Chưa đọc"
                      value={`${detail.data.recipients?.filter((item) => item.isRead).length ?? 0} / ${detail.data.recipients?.filter((item) => !item.isRead).length ?? 0}`}
                    />
                  </div>

                  <Table minWidth="720px">
                    <THead>
                      <tr>
                        <Th>Người nhận</Th>
                        <Th>Email</Th>
                        <Th>Vai trò</Th>
                        <Th>Trạng thái đọc</Th>
                        <Th>Thời gian</Th>
                      </tr>
                    </THead>
                    <TBody>
                      {detail.data.recipients?.map((item) => (
                        <Tr key={item.id}>
                          <Td className="font-medium">{item.user.fullName}</Td>
                          <Td className="text-slate-600">{item.user.email}</Td>
                          <Td className="text-slate-600">{item.user.role}</Td>
                          <Td>
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${item.isRead ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                              {item.isRead ? "Đã đọc" : "Chưa đọc"}
                            </span>
                          </Td>
                          <Td className="whitespace-nowrap text-slate-500">{new Date(item.createdAt).toLocaleString("vi-VN")}</Td>
                        </Tr>
                      ))}
                    </TBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function toPayload(form: FormState) {
  return {
    title: form.title,
    content: form.content,
    type: form.type,
    targetType: form.targetType,
    targetRole: form.targetType === "ROLE" ? form.targetRole : undefined,
    targetUserId: form.targetType === "USER" ? form.targetUserId : undefined,
    targetPartnerId: form.targetType === "PARTNER" ? form.targetPartnerId : undefined
  };
}

function canSubmit(form: FormState) {
  if (form.title.trim().length < 3 || form.content.trim().length < 3) return false;
  if (form.targetType === "USER") return Boolean(form.targetUserId.trim());
  if (form.targetType === "PARTNER") return Boolean(form.targetPartnerId.trim());
  return true;
}

function typeLabel(value: string) {
  return notificationTypes.find((item) => item.value === value)?.label ?? value;
}

function targetLabel(campaign: { targetType: string; targetRole?: string | null; targetUserId?: string | null; targetPartnerId?: string | null; targetUserEmail?: string | null; targetPartnerName?: string | null }) {
  if (campaign.targetType === "ALL") return "Tất cả";
  if (campaign.targetType === "ROLE") return `Vai trò: ${campaign.targetRole}`;
  if (campaign.targetType === "USER") return campaign.targetUserEmail ? `User: ${campaign.targetUserEmail}` : `User: ${campaign.targetUserId || "?"}`;
  if (campaign.targetType === "PARTNER") return campaign.targetPartnerName ? `Partner: ${campaign.targetPartnerName}` : `Partner: ${campaign.targetPartnerId || "?"}`;
  return campaign.targetType;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-slate-950">{value}</p>
    </div>
  );
}
