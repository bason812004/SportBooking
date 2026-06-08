import { useAuth } from "../../features/auth/hooks/useAuth";

export function UserProfilePage() {
  const { user } = useAuth();
  return (
    <div className="rounded-md border border-line bg-white p-5">
      <h1 className="text-2xl font-semibold">Thong tin ca nhan</h1>
      <dl className="mt-4 grid gap-3 text-sm">
        <div><dt className="text-slate-500">Ho ten</dt><dd className="font-medium">{user?.fullName}</dd></div>
        <div><dt className="text-slate-500">Email</dt><dd className="font-medium">{user?.email}</dd></div>
        <div><dt className="text-slate-500">Vai tro</dt><dd className="font-medium">{user?.role}</dd></div>
      </dl>
    </div>
  );
}
