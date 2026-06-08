import { RefreshCcw, Search } from "lucide-react";

export function AdminBlockchainLogsPage() {
  return (
    <div>
      <h1 className="text-5xl font-black">Blockchain Log</h1>
      <p className="mt-4 text-xl text-slate-700">Kiem tra trang thai ghi nhan hash booking, payment va audit len blockchain testnet.</p>
      <section className="mt-10 rounded-3xl border border-[#dfe8dc] bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <label className="flex h-14 min-w-80 items-center gap-3 rounded-xl border border-[#b9cdb7] px-5">
            <Search className="h-5 w-5 text-slate-500" />
            <input className="w-full outline-none" placeholder="Tim tx hash, entity, status..." />
          </label>
          <button className="inline-flex h-14 items-center gap-3 rounded-xl border border-blue-700 px-6 font-bold text-blue-700">
            <RefreshCcw className="h-5 w-5" />
            Retry Failed
          </button>
        </div>
        <div className="mt-8 overflow-auto rounded-2xl border border-[#dfe8dc]">
          <table className="w-full min-w-[1000px] text-left">
            <thead className="bg-[#f1fbef]">
              <tr>
                <th className="p-4">Audit log</th>
                <th>Entity</th>
                <th>Payload hash</th>
                <th>Network</th>
                <th>Tx hash</th>
                <th>Status</th>
                <th>Confirmed at</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-8 text-center text-slate-500" colSpan={7}>Chua co endpoint blockchain log trong frontend API. Trang da san sang de noi backend.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
