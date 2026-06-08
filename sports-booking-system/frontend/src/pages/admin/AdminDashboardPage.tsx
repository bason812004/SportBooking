import { useQuery } from "@tanstack/react-query";
import { CircleCheck, FolderCheck, Shield, TrendingUp, UserRoundCheck, Users, WalletCards } from "lucide-react";
import { adminApi } from "../../features/admin/api/adminApi";
import { LoadingState, ErrorState } from "../../components/common/States";

const growth = [38, 55, 44, 72, 62, 95, 112];

function dashboardValue(data: Record<string, number> | undefined, keys: string[], fallback: number) {
  const key = keys.find((item) => typeof data?.[item] === "number");
  return key ? data?.[key] ?? fallback : fallback;
}

export function AdminDashboardPage() {
  const dashboard = useQuery({ queryKey: ["admin-dashboard"], queryFn: adminApi.dashboard });
  if (dashboard.isLoading) return <LoadingState />;
  if (dashboard.isError) return <ErrorState message={dashboard.error.message} />;

  const raw = dashboard.data;
  const stats = [
    { label: "Tong User", value: dashboardValue(raw, ["users", "totalUsers", "userCount"], 24592).toLocaleString("vi-VN"), note: "+12% this month", icon: Users, tone: "bg-[#dcfce7]" },
    { label: "Tong Partner", value: dashboardValue(raw, ["partners", "totalPartners", "partnerCount"], 1204).toLocaleString("vi-VN"), note: "+5% this month", icon: UserRoundCheck, tone: "bg-blue-100" },
    { label: "Doanh thu he thong", value: `${dashboardValue(raw, ["revenue", "totalRevenue"], 845000000).toLocaleString("vi-VN")} d`, note: "+8.2% this month", icon: WalletCards, tone: "bg-red-100" },
    { label: "San cho duyet", value: dashboardValue(raw, ["pendingCourts", "courtsPending"], 18).toLocaleString("vi-VN"), note: "Requires immediate action", icon: FolderCheck, tone: "bg-[#eaf3e7]" }
  ];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="text-6xl font-black tracking-tight">System Overview</h1>
          <p className="mt-5 text-2xl text-slate-700">Welcome back, Admin. Here is what's happening today.</p>
        </div>
        <span className="inline-flex items-center gap-3 rounded-full border border-[#b9cdb7] bg-white px-6 py-4 text-lg font-bold text-[#112015]">
          <CircleCheck className="h-7 w-7 text-[#24c866]" />
          System Optimal
        </span>
      </div>

      <div className="mt-14 grid gap-8 xl:grid-cols-4">
        {stats.map((item, index) => (
          <div key={item.label} className={`rounded-3xl border border-[#dfe8dc] bg-white p-8 shadow-sm ${index === 3 ? "border-l-4 border-l-red-700" : ""}`}>
            <div className="flex justify-between gap-4">
              <p className="text-xl font-bold tracking-wide">{item.label}</p>
              <span className={`rounded-full p-4 ${item.tone}`}>
                <item.icon className="h-6 w-6 text-[#02712a]" />
              </span>
            </div>
            <p className="mt-8 text-5xl font-black">{item.value}</p>
            <p className={`mt-5 flex items-center gap-2 ${index === 3 ? "text-red-700" : "text-[#00b83e]"}`}>
              {index !== 3 && <TrendingUp className="h-4 w-4" />}
              {item.note}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-14 grid gap-8 xl:grid-cols-[1fr_360px]">
        <section className="rounded-3xl border border-[#dfe8dc] bg-white p-10 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-4xl font-black">Growth Overview</h2>
            <button className="rounded-xl border border-[#b9cdb7] bg-[#f1fbef] px-6 py-3">Last 30 Days</button>
          </div>
          <div className="mt-10 grid h-80 grid-cols-7 items-end gap-4 rounded-2xl border border-[#dfe8dc] bg-[#f8fcf6] p-10">
            {growth.map((height, index) => (
              <div key={index} className={`rounded-t-md ${index === growth.length - 1 ? "bg-[#24c866]" : "bg-[#a7efc3]"}`} style={{ height }} />
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-[#dfe8dc] bg-white p-10 shadow-sm">
          <div className="flex items-start justify-between">
            <h2 className="text-4xl font-black leading-tight">Pending Approvals</h2>
            <a href="/admin/courts/pending" className="text-xl font-bold text-blue-700">View All</a>
          </div>
          <div className="mt-8 space-y-5">
            {["San Bong Mini Le Van Sy", "CLB Tennis Binh Thanh", "Cum cau long Go Vap"].map((name, index) => (
              <div key={name} className="rounded-2xl border border-[#b9cdb7] bg-[#f1fbef] p-5">
                <div className="flex items-center gap-4">
                  <img className="h-14 w-10 rounded-lg object-cover" src={`https://images.unsplash.com/photo-${index === 1 ? "1622279457486-62dcc4a431d6" : "1579952363873-27f3bade9f55"}?auto=format&fit=crop&w=200&q=80`} alt={name} />
                  <div className="flex-1">
                    <p className="text-lg font-bold leading-tight">{name}</p>
                    <p className="text-slate-600">{index === 1 ? "Tennis Court" : "Football Court"}</p>
                    <p className="text-slate-600">• District {index + 3}</p>
                  </div>
                  <button className="rounded-full bg-[#02712a] px-4 py-2 font-bold text-white">Review</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-14 flex flex-wrap items-center gap-6 rounded-3xl border border-[#dfe8dc] bg-white p-8 shadow-sm">
        <span className="rounded-full bg-blue-100 p-5 text-blue-700">
          <Shield className="h-8 w-8" />
        </span>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">Blockchain Synchronization</h2>
          <p className="text-lg text-slate-700">All booking ledgers are secured and synced.</p>
        </div>
        <p className="font-bold">Just now (Block #1428593)</p>
        <p className="border-l border-[#b9cdb7] pl-8">Node Status <span className="ml-3 text-[#00b83e]">● Healthy</span></p>
      </section>
    </div>
  );
}
