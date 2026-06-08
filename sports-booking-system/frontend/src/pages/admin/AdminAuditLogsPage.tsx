import { CheckCircle2, Search } from "lucide-react";

export function AdminAuditLogsPage() {
  return (
    <div>
      <h1 className="text-5xl font-black">Audit Log</h1>
      <p className="mt-4 text-xl text-slate-700">Theo doi lich su hanh dong quan trong trong he thong.</p>
      <section className="mt-10 rounded-3xl border border-[#dfe8dc] bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <label className="flex h-14 min-w-80 items-center gap-3 rounded-xl border border-[#b9cdb7] px-5">
            <Search className="h-5 w-5 text-slate-500" />
            <input className="w-full outline-none" placeholder="Tim action, actor, entity..." />
          </label>
          <button className="inline-flex h-14 items-center gap-3 rounded-xl bg-[#02712a] px-6 font-bold text-white">
            <CheckCircle2 className="h-5 w-5" />
            Verify Audit Chain
          </button>
        </div>
        <div className="mt-8 overflow-auto rounded-2xl border border-[#dfe8dc]">
          <table className="w-full min-w-[900px] text-left">
            <thead className="bg-[#f1fbef]">
              <tr>
                <th className="p-4">Action</th>
                <th>Actor</th>
                <th>Role</th>
                <th>Entity</th>
                <th>Previous hash</th>
                <th>Current hash</th>
                <th>Created at</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-8 text-center text-slate-500" colSpan={7}>Chua co endpoint audit log trong frontend API. Trang da san sang de noi backend.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
