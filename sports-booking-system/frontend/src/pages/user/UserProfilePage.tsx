import { useAuth } from "../../features/auth/hooks/useAuth";
import { useLanguage } from "../../lib/i18n";

export function UserProfilePage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  return (
    <div className="rounded-md border border-line bg-white p-5">
      <h1 className="text-2xl font-semibold">{t("Thông tin cá nhân")}</h1>
      <dl className="mt-4 grid gap-3 text-sm">
        <div><dt className="text-slate-500">{t("Họ tên")}</dt><dd className="font-medium">{user?.fullName}</dd></div>
        <div><dt className="text-slate-500">Email</dt><dd className="font-medium">{user?.email}</dd></div>
        <div><dt className="text-slate-500">{t("Vai trò")}</dt><dd className="font-medium">{user?.role}</dd></div>
      </dl>
    </div>
  );
}
