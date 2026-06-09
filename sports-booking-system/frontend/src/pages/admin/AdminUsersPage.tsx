import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi } from "../../features/admin/api/adminApi";
import { LoadingState, ErrorState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { useLanguage } from "../../lib/i18n";

export function AdminUsersPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const users = useQuery({ queryKey: ["admin-users"], queryFn: adminApi.users });
  const toggle = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => (status === "ACTIVE" ? adminApi.lockUser(id) : adminApi.unlockUser(id)),
    onSuccess: () => {
      toast.success(t("Đã cập nhật tài khoản"));
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    }
  });
  if (users.isLoading) return <LoadingState />;
  if (users.isError) return <ErrorState message={users.error.message} />;
  return (
    <div className="overflow-auto rounded-md border border-line bg-white">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-field text-left"><tr><th className="p-3">{t("Họ tên")}</th><th>Email</th><th>{t("Vai trò")}</th><th>{t("Trạng thái")}</th><th></th></tr></thead>
        <tbody>
          {users.data?.items.map((user) => (
            <tr key={user.id} className="border-t border-line">
              <td className="p-3 font-medium">{user.fullName}</td><td>{user.email}</td><td>{user.role}</td><td>{user.status}</td>
              <td className="p-3 text-right"><Button variant="secondary" onClick={() => toggle.mutate({ id: user.id, status: user.status })}>{user.status === "ACTIVE" ? t("Khóa") : t("Mở khóa")}</Button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
