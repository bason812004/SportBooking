import { useEffect, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Camera, KeyRound, Mail, Phone, Save, ShieldCheck, UserRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ErrorState, LoadingState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { authApi } from "../../features/auth/api/authApi";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { userApi } from "../../features/user/api/userApi";

type ProfileValues = { fullName: string; phone: string; avatarUrl: string };
type PasswordValues = { currentPassword: string; newPassword: string; confirmPassword: string };

export function UserProfilePage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ["user-profile"], queryFn: userApi.me, enabled: Boolean(auth.token) });
  const user = profile.data ?? auth.user;
  const profileForm = useForm<ProfileValues>({ defaultValues: { fullName: "", phone: "", avatarUrl: "" } });
  const passwordForm = useForm<PasswordValues>();

  useEffect(() => {
    if (!profile.data || !auth.token) return;
    auth.setSession(profile.data, auth.token, auth.refreshToken ?? undefined);
  }, [auth, profile.data]);

  useEffect(() => {
    if (!user) return;
    profileForm.reset({ fullName: user.fullName, phone: user.phone ?? "", avatarUrl: user.avatarUrl ?? "" });
  }, [profileForm, user]);

  const saveProfile = useMutation({
    mutationFn: (values: ProfileValues) => userApi.updateMe({ ...values, avatarUrl: values.avatarUrl || undefined }),
    onSuccess: async (updated) => {
      auth.setSession(updated, auth.token!, auth.refreshToken ?? undefined);
      await queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      toast.success("Đã cập nhật hồ sơ cá nhân.");
    },
    onError: (error) => toast.error(error.message)
  });

  const changePassword = useMutation({
    mutationFn: (values: PasswordValues) => authApi.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
    onSuccess: () => {
      passwordForm.reset();
      toast.success("Đổi mật khẩu thành công.");
    },
    onError: (error) => toast.error(error.message)
  });

  if (profile.isLoading && !user) return <LoadingState label="Đang tải hồ sơ..." />;
  if (profile.isError && !user) return <ErrorState message={profile.error.message || "Không thể tải hồ sơ."} onRetry={() => void profile.refetch()} />;
  if (!user) return <ErrorState message="Không tìm thấy thông tin tài khoản." />;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-violet-700 p-6 text-white shadow-xl sm:p-8">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border-4 border-white/30 bg-white/15 text-3xl font-black">
            {user.avatarUrl ? <img src={user.avatarUrl} alt={user.fullName} className="h-full w-full object-cover" /> : user.fullName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-100">Hồ sơ thành viên</p>
            <h1 className="mt-1 text-3xl font-black">{user.fullName}</h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-white/75"><Mail className="h-4 w-4" />{user.email}</p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-400/20 px-4 py-2 text-sm font-bold text-emerald-100 sm:ml-auto">
            <ShieldCheck className="h-4 w-4" />
            Tài khoản hoạt động
          </span>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <form className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" onSubmit={profileForm.handleSubmit((v) => saveProfile.mutate(v))}>
          <div className="mb-6 flex items-center gap-3">
            <span className="rounded-2xl bg-blue-50 p-3 text-blue-700"><UserRound /></span>
            <div>
              <h2 className="text-xl font-black">Thông tin cá nhân</h2>
              <p className="text-sm text-slate-500">Thông tin dùng cho đặt sân và liên hệ</p>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Input label="Họ và tên" {...profileForm.register("fullName", { required: "Vui lòng nhập họ tên", minLength: 2 })} error={profileForm.formState.errors.fullName?.message} />
            <Input label="Số điện thoại" type="tel" {...profileForm.register("phone")} />
            <Input label="Email" value={user.email} disabled className="bg-slate-50" />
            <Input label="Ảnh đại diện (URL)" type="url" {...profileForm.register("avatarUrl")} />
          </div>
          <Button className="mt-6" disabled={saveProfile.isPending}>
            <Save className="h-4 w-4" />
            {saveProfile.isPending ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </form>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-black">Tổng quan tài khoản</h3>
            <div className="mt-5 space-y-4 text-sm">
              <Info icon={<Mail />} label="Email" value={user.email} />
              <Info icon={<Phone />} label="Điện thoại" value={user.phone || "Chưa cập nhật"} />
              <Info icon={<CalendarDays />} label="Vai trò" value="Thành viên" />
            </div>
          </div>
          <div className="rounded-3xl bg-amber-50 p-5 text-sm text-amber-900">
            <div className="flex gap-3">
              <Camera className="h-5 w-5 shrink-0" />
              <p>Dùng đường dẫn ảnh HTTPS để ảnh đại diện hiển thị rõ trên hồ sơ và đánh giá của bạn.</p>
            </div>
          </div>
        </aside>
      </div>

      <form
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        onSubmit={passwordForm.handleSubmit((v) =>
          v.newPassword === v.confirmPassword
            ? changePassword.mutate(v)
            : passwordForm.setError("confirmPassword", { message: "Mật khẩu xác nhận không khớp" })
        )}
      >
        <div className="mb-6 flex items-center gap-3">
          <span className="rounded-2xl bg-violet-50 p-3 text-violet-700"><KeyRound /></span>
          <div>
            <h2 className="text-xl font-black">Bảo mật</h2>
            <p className="text-sm text-slate-500">Đổi mật khẩu định kỳ để bảo vệ tài khoản</p>
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <Input label="Mật khẩu hiện tại" type="password" {...passwordForm.register("currentPassword", { required: true })} />
          <Input label="Mật khẩu mới" type="password" {...passwordForm.register("newPassword", { required: true, minLength: { value: 8, message: "Tối thiểu 8 ký tự" } })} error={passwordForm.formState.errors.newPassword?.message} />
          <Input label="Xác nhận mật khẩu mới" type="password" {...passwordForm.register("confirmPassword", { required: true })} error={passwordForm.formState.errors.confirmPassword?.message} />
        </div>
        <Button className="mt-6" disabled={changePassword.isPending}>Cập nhật mật khẩu</Button>
      </form>
    </div>
  );
}

function Info({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-slate-400 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="truncate font-semibold text-slate-700">{value}</p>
      </div>
    </div>
  );
}
