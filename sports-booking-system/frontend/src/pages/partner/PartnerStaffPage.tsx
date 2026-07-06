import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, ShieldAlert } from "lucide-react";
import { partnerApi } from "../../features/partner/api/partnerApi";
import { LoadingState, ErrorState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { ConfirmModal } from "../../components/common/ConfirmModal";

export function PartnerStaffPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editStaff, setEditStaff] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form states
  const [fullName, setFullName] = useState("");
  const [emailSuffix, setEmailSuffix] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [managedCourtId, setManagedCourtId] = useState("");

  const staffQuery = useQuery({ queryKey: ["partner-recipients"], queryFn: partnerApi.listRecipients });
  const courtsQuery = useQuery({ queryKey: ["partner-courts"], queryFn: partnerApi.courts });
  const profileQuery = useQuery({ queryKey: ["partner-profile"], queryFn: partnerApi.profile });

  const createMutation = useMutation({
    mutationFn: partnerApi.createRecipient,
    onSuccess: () => {
      toast.success("Đã thêm tài khoản nhân viên mới");
      closeModal();
      queryClient.invalidateQueries({ queryKey: ["partner-recipients"] });
    },
    onError: (error: any) => toast.error(error.response?.data?.message || error.message || "Không thể tạo tài khoản")
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => partnerApi.updateRecipient(id, payload),
    onSuccess: () => {
      toast.success("Đã cập nhật thông tin nhân viên");
      closeModal();
      queryClient.invalidateQueries({ queryKey: ["partner-recipients"] });
    },
    onError: (error: any) => toast.error(error.response?.data?.message || error.message || "Không thể cập nhật")
  });

  const deleteMutation = useMutation({
    mutationFn: partnerApi.deleteRecipient,
    onSuccess: () => {
      toast.success("Đã xóa tài khoản nhân viên");
      setDeleteConfirm(null);
      queryClient.invalidateQueries({ queryKey: ["partner-recipients"] });
    },
    onError: (error: any) => toast.error(error.response?.data?.message || error.message || "Không thể xóa nhân viên")
  });

  if (staffQuery.isLoading || courtsQuery.isLoading || profileQuery.isLoading) return <LoadingState />;
  if (staffQuery.isError) return <ErrorState message={staffQuery.error.message} />;

  const partnerEmail = profileQuery.data?.user?.email || "";
  const [localPart, domain] = partnerEmail.split("@");

  const openCreateModal = () => {
    setEditStaff(null);
    setFullName("");
    setEmailSuffix("");
    setPassword("");
    setPhone("");
    setManagedCourtId(courtsQuery.data?.[0]?.id || "");
    setModalOpen(true);
  };

  const openEditModal = (staff: any) => {
    setEditStaff(staff);
    setFullName(staff.fullName);
    setPhone(staff.phone || "");
    setPassword("");
    setManagedCourtId(staff.managedCourtId || "");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditStaff(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return toast.error("Vui lòng điền họ tên");
    if (!managedCourtId) return toast.error("Vui lòng chọn sân phân công");

    if (editStaff) {
      const payload: any = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        managedCourtId
      };
      if (password.trim()) {
        if (password.length < 6) return toast.error("Mật khẩu phải từ 6 ký tự");
        payload.password = password;
      }
      updateMutation.mutate({ id: editStaff.id, payload });
    } else {
      if (!emailSuffix.trim()) return toast.error("Vui lòng điền mã nhân viên");
      if (!password.trim() || password.length < 6) return toast.error("Mật khẩu phải từ 6 ký tự");

      createMutation.mutate({
        fullName: fullName.trim(),
        emailSuffix: emailSuffix.trim(),
        password: password.trim(),
        phone: phone.trim(),
        managedCourtId
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-800">Quản lý Nhân Viên</h1>
          <p className="text-slate-600 mt-1">
            Mỗi nhân viên sẽ quản lý một sân bóng thuộc chi nhánh của bạn.
          </p>
        </div>
        <Button className="flex items-center gap-2" onClick={openCreateModal}>
          <Plus className="h-4 w-4" /> Thêm nhân viên
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="p-4 font-semibold text-slate-600">Họ và tên</th>
              <th className="p-4 font-semibold text-slate-600">Email đăng nhập</th>
              <th className="p-4 font-semibold text-slate-600">Số điện thoại</th>
              <th className="p-4 font-semibold text-slate-600">Sân quản lý</th>
              <th className="p-4 font-semibold text-slate-600">Trạng thái</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody>
            {staffQuery.data?.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  Chưa có tài khoản nhân viên nào được tạo.
                </td>
              </tr>
            ) : (
              staffQuery.data?.map((staff) => (
                <tr key={staff.id} className="border-b hover:bg-slate-50">
                  <td className="p-4 font-bold text-slate-800">{staff.fullName}</td>
                  <td className="p-4 font-mono text-slate-600">{staff.email}</td>
                  <td className="p-4 text-slate-600">{staff.phone || "Chưa cung cấp"}</td>
                  <td className="p-4 font-semibold text-emerald-800">{staff.managedCourt?.name || "Chưa phân công"}</td>
                  <td className="p-4">
                    <span className="bg-green-100 text-green-800 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                      Hoạt động
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2 justify-end">
                      <Button variant="secondary" onClick={() => openEditModal(staff)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="danger" onClick={() => setDeleteConfirm(staff.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold mb-4 text-slate-800">
              {editStaff ? "Cập nhật nhân viên" : "Thêm tài khoản nhân viên"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">Họ và tên nhân viên</label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nguyễn Văn A" required />
              </div>

              {!editStaff && (
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Mã nhân viên (Đuôi email)</label>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-sm text-slate-500 bg-slate-100 p-2 rounded-lg border">{localPart}+</span>
                    <Input
                      value={emailSuffix}
                      onChange={(e) => setEmailSuffix(e.target.value)}
                      placeholder="nv1"
                      className="font-mono"
                      required
                    />
                    <span className="font-mono text-sm text-slate-500 bg-slate-100 p-2 rounded-lg border">@{domain}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    Email đăng nhập sẽ là: <span className="font-bold text-slate-700">{localPart}+{emailSuffix || "nv1"}@{domain}</span>
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">
                  Mật khẩu {editStaff && "(Để trống nếu không muốn đổi)"}
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="******"
                  required={!editStaff}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">Số điện thoại</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0987654321" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">Sân phân công quản lý</label>
                <Select
                  value={managedCourtId}
                  onChange={(e) => setManagedCourtId(e.target.value)}
                  options={courtsQuery.data?.map((court) => ({ value: court.id, label: court.name })) || []}
                  required
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <Button type="button" variant="secondary" onClick={closeModal}>
                  Hủy
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editStaff ? "Lưu thay đổi" : "Tạo tài khoản"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteConfirm)}
        title="Xác nhận xóa nhân viên"
        message="Nhân viên này sẽ bị xóa vĩnh viễn khỏi danh sách quản lý. Họ sẽ không thể đăng nhập vào cổng quản lý sân nữa."
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
      />
    </div>
  );
}
