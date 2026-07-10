import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Eye, Send } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, LoadingState } from "../../components/common/States";
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

  if (campaigns.isLoading) return <LoadingState />;
  if (campaigns.isError) return <ErrorState message={campaigns.error.message} />;

  return (
    <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
      <section className="h-max rounded-lg border bg-white p-5">
        <div className="flex items-center gap-2">
          <BellRing className="h-5 w-5 text-emerald-700" />
          <h1 className="text-xl font-bold">Gửi thông báo</h1>
        </div>
        <div className="mt-5 space-y-4">
          <Input label="Tiêu đề" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          <label className="grid gap-1.5 text-sm font-medium text-ink">
            <span>Nội dung</span>
            <textarea
              className="min-h-32 rounded-md border border-line bg-white p-3 text-sm outline-none focus:border-action"
              value={form.content}
              onChange={(event) => setForm({ ...form, content: event.target.value })}
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
          <Button className="w-full" disabled={create.isPending || !canSubmit(form)} onClick={() => create.mutate()}>
            <Send className="h-4 w-4" />
            Gửi thông báo
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-3xl font-bold">Lịch sử thông báo</h2>
            <p className="text-sm text-slate-600">Theo dõi các chiến dịch thông báo admin đã gửi.</p>
          </div>
          <Input label="Tìm kiếm" value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder="Tiêu đề, nội dung, admin gửi" />
        </div>

        <Table minWidth="920px">
          <THead>
            <tr>
              <Th>Thông báo</Th>
              <Th>Loại</Th>
              <Th>Đối tượng</Th>
              <Th>Người nhận</Th>
              <Th>Admin gửi</Th>
              <Th>Thời gian</Th>
              <Th></Th>
            </tr>
          </THead>
          <TBody>
            {campaigns.data?.items.map((campaign) => (
              <Tr key={campaign.id} className="align-top">
                <Td>
                  <p className="font-bold">{campaign.title}</p>
                  <p className="line-clamp-2 text-xs text-slate-500">{campaign.content}</p>
                </Td>
                <Td>{typeLabel(campaign.type)}</Td>
                <Td>{targetLabel(campaign)}</Td>
                <Td>{campaign.recipientCount}</Td>
                <Td>{campaign.sender?.fullName ?? "-"}</Td>
                <Td>{new Date(campaign.createdAt).toLocaleString("vi-VN")}</Td>
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
        {!campaigns.data?.items.length && <p className="p-6 text-center text-slate-500">Chưa có thông báo nào</p>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</Button>
          <Button variant="secondary" disabled={page >= (campaigns.data?.meta.totalPages ?? 1)} onClick={() => setPage(page + 1)}>Sau</Button>
        </div>

        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6" onMouseDown={() => setSelected(null)}>
            <div className="flex max-h-[calc(100vh-48px)] w-full max-w-4xl flex-col rounded-lg bg-white shadow-xl" onMouseDown={(event) => event.stopPropagation()}>
              <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
                <h3 className="text-xl font-bold">Chi tiết thông báo</h3>
                <Button variant="secondary" onClick={() => setSelected(null)}>Đóng</Button>
              </div>
              <div className="min-h-0 overflow-y-auto p-5">
                {detail.isLoading && <LoadingState />}
                {detail.isError && <ErrorState message={detail.error.message} />}
                {detail.data && (
                  <div className="space-y-5">
                    <div>
                      <h4 className="text-lg font-bold">{detail.data.title}</h4>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{detail.data.content}</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <Info label="Loại" value={typeLabel(detail.data.type)} />
                      <Info label="Đối tượng" value={targetLabel(detail.data)} />
                      <Info label="Người nhận" value={String(detail.data.recipientCount)} />
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
                            <Td>{item.user.email}</Td>
                            <Td>{item.user.role}</Td>
                            <Td>{item.isRead ? "Đã đọc" : "Chưa đọc"}</Td>
                            <Td>{new Date(item.createdAt).toLocaleString("vi-VN")}</Td>
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
      </section>
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
  if (campaign.targetType === "USER") return campaign.targetUserEmail ? `User: ${campaign.targetUserEmail}` : `User: ${campaign.targetUserId}`;
  if (campaign.targetType === "PARTNER") return campaign.targetPartnerName ? `Partner: ${campaign.targetPartnerName}` : `Partner: ${campaign.targetPartnerId}`;
  return campaign.targetType;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}
